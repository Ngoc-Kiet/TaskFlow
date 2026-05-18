const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Chỉ bật JsonDB khi chạy máy local (dev). Môi trường production (Render) bắt buộc dùng MongoDB!
global.__USE_JSONDB__ = process.env.NODE_ENV !== 'production';

// Patch mongoose NGAY KHI MODULE LOAD nếu đang dùng JsonDB
if (global.__USE_JSONDB__) {
  patchMongooseWithJsonDB();
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<') || uri.includes('>')) {
    console.warn('⚠️  MONGODB_URI chưa cấu hình → Dùng JsonDB (offline mode)');
    return;
  }
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 8000,
      family: 4,
    });
    console.log(`✅ MongoDB Available: ${conn.connection.host}`);
  } catch (error) {
    console.log('🔄 MongoDB không khả dụng → Dùng JsonDB (data lưu trong backend/data/)');
  }
};

// ============================================================
// JSONDB ENGINE - Patch mongoose.model để dùng file JSON store
// ============================================================
function patchMongooseWithJsonDB() {
  const { col } = require('./jsonDb');

  // ---- addDocMethods: gắn instance methods cho mọi doc từ JsonDB ----
  const addDocMethods = (collName, doc) => {
    if (!doc) return null;
    const c = col(collName);

    // patchSubdocArray: thêm .id() cho arrays (comments, checklist...)
    const patchSubdocArray = (arr) => {
      if (!Array.isArray(arr)) return arr;
      arr.id = (id) => {
        const found = arr.find(item => String(item._id) === String(id));
        if (!found) return null;
        found.deleteOne = () => {
          const idx = arr.findIndex(item => String(item._id) === String(id));
          if (idx !== -1) arr.splice(idx, 1);
        };
        return found;
      };
      arr.forEach(item => {
        if (item && typeof item === 'object' && !item._id) {
          item._id = require('crypto').randomBytes(12).toString('hex');
        }
      });
      return arr;
    };

    // save - normalize ref fields về IDs trước khi ghi
    const REF_ARRAY_FIELDS = ['assignees', 'tags']; // array ref fields
    const REF_FIELDS = ['owner', 'creator', 'sender', 'recipient', 'author', 'project', 'relatedTask', 'relatedProject'];

    doc.save = async () => {
      const data = {};
      Object.keys(doc).forEach(k => {
        if (typeof doc[k] === 'function') return;
        const v = doc[k];

        // Normalize: array of objects → array of IDs
        if (REF_ARRAY_FIELDS.includes(k) && Array.isArray(v)) {
          data[k] = v.map(item => (typeof item === 'object' && item !== null) ? (item._id || item) : item);
        }
        // Normalize: single ref object → ID
        else if (REF_FIELDS.includes(k) && v && typeof v === 'object' && !Array.isArray(v)) {
          data[k] = v._id || v;
        }
        // Normalize: comments/attachments array → strip populated sub-fields back to IDs
        else if (k === 'comments' && Array.isArray(v)) {
          data[k] = v.map(c => ({
            ...Object.fromEntries(Object.entries(c).filter(([ck]) => typeof c[ck] !== 'function')),
            author: c.author && typeof c.author === 'object' ? (c.author._id || c.author) : c.author
          }));
        }
        else if (k === 'members' && Array.isArray(v)) {
          data[k] = v.map(m => ({
            ...Object.fromEntries(Object.entries(m).filter(([mk]) => typeof m[mk] !== 'function')),
            user: m.user && typeof m.user === 'object' ? (m.user._id || m.user) : m.user
          }));
        }
        else if (k === 'attachments' && Array.isArray(v)) {
          data[k] = v.map(a => ({
            ...Object.fromEntries(Object.entries(a).filter(([ak]) => typeof a[ak] !== 'function')),
            uploadedBy: a.uploadedBy && typeof a.uploadedBy === 'object' ? (a.uploadedBy._id || a.uploadedBy) : a.uploadedBy
          }));
        }
        else {
          data[k] = v;
        }
      });

      // Hash password nếu là users collection và password chưa hash
      const isUserCollection = c.name === 'users';
      if (isUserCollection && data.password && !data.password.startsWith('$2a$') && !data.password.startsWith('$2b$')) {
        data.password = await bcrypt.hash(data.password, 12);
        doc.password = data.password; // sync lại doc
      }

      // Xóa các field reset token khỏi data nếu là undefined
      if (isUserCollection) {
        if (data.resetPasswordCode === undefined) delete data.resetPasswordCode;
        if (data.resetPasswordExpiry === undefined) delete data.resetPasswordExpiry;
      }

      c.updateOne({ _id: doc._id }, { $set: data });
      // Re-patch subdoc arrays sau save
      if (Array.isArray(doc.comments)) patchSubdocArray(doc.comments);
      if (Array.isArray(doc.checklist)) patchSubdocArray(doc.checklist);
      if (Array.isArray(doc.attachments)) patchSubdocArray(doc.attachments);
      return doc;
    };


    // toObject / toJSON
    doc.toObject = () => {
      const obj = {};
      Object.keys(doc).forEach(k => {
        if (typeof doc[k] !== 'function') obj[k] = doc[k];
      });
      return obj;
    };
    doc.toJSON = doc.toObject;

    // populate
    doc.populate = async (path, select) => {
      const parts = path.split('.');
      const fieldName = parts[0];
      const subField = parts[1];
      const fieldVal = doc[fieldName];

      const subFieldToCollection = {
        user: 'users', author: 'users', creator: 'users',
        owner: 'users', sender: 'users', recipient: 'users',
        uploadedBy: 'users', project: 'projects',
      };
      const fieldToCollection = {
        owner: 'users', creator: 'users', sender: 'users', recipient: 'users',
        author: 'users', user: 'users', assignees: 'users', members: 'users',
        project: 'projects', task: 'tasks', relatedTask: 'tasks', relatedProject: 'projects',
      };

      const resolveDoc = (refColName, id) => {
        const rawId = typeof id === 'object' && id !== null ? (id._id || id) : id;
        const refCol = col(refColName);
        const resolved = refCol.findOne({ _id: String(rawId) });
        if (!resolved) return null;
        if (!select) return { ...resolved };
        const clean = { _id: resolved._id };
        select.split(' ').forEach(k => { if (resolved[k] !== undefined) clean[k] = resolved[k]; });
        return clean;
      };

      if (subField && Array.isArray(fieldVal)) {
        const refCollName = subFieldToCollection[subField] || subField + 's';
        doc[fieldName] = fieldVal.map(item => {
          if (typeof item === 'object' && item[subField]) {
            const resolved = resolveDoc(refCollName, item[subField]);
            if (resolved) return { ...item, [subField]: resolved };
          }
          return item;
        });
        patchSubdocArray(doc[fieldName]);
      } else if (!subField) {
        const refCollName = fieldToCollection[fieldName] || fieldName + 's';
        if (Array.isArray(fieldVal)) {
          doc[fieldName] = fieldVal.map(id => resolveDoc(refCollName, id) || id);
        } else if (fieldVal) {
          const resolved = resolveDoc(refCollName, fieldVal);
          if (resolved) doc[fieldName] = resolved;
        }
      }
      return doc;
    };

    // deleteOne (instance)
    doc.deleteOne = async () => { c.deleteOne({ _id: doc._id }); return { deletedCount: 1 }; };
    doc.remove = doc.deleteOne;

    // User methods
    if (collName === 'users') {
      doc.comparePassword = async (pw) => await bcrypt.compare(pw, doc.password);
      doc.getAvatarUrl = () => doc.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name || 'U')}&background=6366f1&color=fff&size=200`;
    }

    // Patch subdoc arrays
    if (Array.isArray(doc.comments)) patchSubdocArray(doc.comments);
    if (Array.isArray(doc.checklist)) patchSubdocArray(doc.checklist);
    if (Array.isArray(doc.attachments)) patchSubdocArray(doc.attachments);
    if (Array.isArray(doc.members)) patchSubdocArray(doc.members);

    return doc;
  };

  // ---- makeQ: Chainable query builder ----
  const makeQ = (collName, rawDocs, isSingle = false) => {
    let _docs = Array.isArray(rawDocs) ? rawDocs : (rawDocs ? [rawDocs] : []);
    let _sort = null, _skip = 0, _limit = null;
    let _populates = []; // ← thu thập populate calls

    const q = {
      sort(s) { _sort = s; return q; },
      skip(n) { _skip = n; return q; },
      limit(n) { _limit = n; return q; },
      select() { return q; },
      // ← populate thật - lưu lại để apply khi resolve
      populate(path, select) { _populates.push({ path, select }); return q; },
      lean() { return q; },
      exec() { return q; },

      countDocuments() {
        return Promise.resolve(_docs.length);
      },
      distinct(field) {
        const vals = [...new Set(_docs.map(d => d[field]).filter(v => v != null))];
        return Promise.resolve(vals);
      },

      then(resolve, reject = () => {}) {
        (async () => {
          try {
            let r = [..._docs];
            if (_sort) {
              const entries = Object.entries(_sort);
              if (entries.length > 0) {
                const [k, v] = entries[0];
                r.sort((a, b) => {
                  const av = a[k], bv = b[k];
                  if (av == null && bv == null) return 0;
                  if (av == null) return v === 1 ? -1 : 1;
                  if (bv == null) return v === 1 ? 1 : -1;
                  return v === 1 || v === 'asc'
                    ? (av > bv ? 1 : av < bv ? -1 : 0)
                    : (av < bv ? 1 : av > bv ? -1 : 0);
                });
              }
            }
            if (_skip) r = r.slice(_skip);
            if (_limit) r = r.slice(0, _limit);

            // Apply methods + populates async
            const applyAll = async (d) => {
              const doc = addDocMethods(collName, Object.assign({}, d));
              for (const { path, select } of _populates) {
                await doc.populate(path, select);
              }
              return doc;
            };

            const result = isSingle
              ? (r[0] ? await applyAll(r[0]) : null)
              : await Promise.all(r.map(d => applyAll(d)));

            resolve(result);
          } catch (e) { if (typeof reject === 'function') reject(e); }
        })();
      },
      catch(fn) { return this; },
    };
    return q;
  };


  // ---- makeModel: factory tạo model cho từng collection ----
  const makeModel = (collName) => {
    const c = col(collName);
    const isUser = collName === 'users';

    return {
      find: (q = {}) => makeQ(collName, c.find(q), false),
      findOne: (q = {}) => makeQ(collName, c.findOne(q) ? [c.findOne(q)] : [], true),
      findById: (id) => makeQ(collName, c.findOne({ _id: String(id) }) ? [c.findOne({ _id: String(id) })] : [], true),

      create: async (data) => {
        if (Array.isArray(data)) {
          const docs = [];
          for (const d of data) {
            const item = { ...d };
            if (isUser && item.password) item.password = await bcrypt.hash(item.password, 12);
            if (isUser && item.email) item.email = item.email.toLowerCase();
            docs.push(addDocMethods(collName, c.insertOne(item)));
          }
          return docs;
        }
        const item = { ...data };
        if (isUser && item.password) item.password = await bcrypt.hash(item.password, 12);
        if (isUser && item.email) item.email = item.email.toLowerCase();
        return addDocMethods(collName, c.insertOne(item));
      },

      insertMany: async (arr) => {
        const docs = [];
        for (const data of arr) {
          const item = { ...data };
          if (isUser && item.password) item.password = await bcrypt.hash(item.password, 12);
          docs.push(addDocMethods(collName, c.insertOne(item)));
        }
        return docs;
      },

      findByIdAndUpdate: (id, update, opts = {}) => {
        c.updateOne({ _id: String(id) }, update);
        return makeQ(collName, c.findOne({ _id: String(id) }) ? [c.findOne({ _id: String(id) })] : [], true);
      },

      findOneAndUpdate: (query, update, opts = {}) => {
        c.updateOne(query, update);
        const doc = c.findOne(query);
        return makeQ(collName, doc ? [doc] : [], true);
      },

      findByIdAndDelete: (id) => {
        const doc = c.findOne({ _id: String(id) });
        if (doc) c.deleteOne({ _id: String(id) });
        return makeQ(collName, doc ? [doc] : [], true);
      },

      updateOne: async (q, u) => ({ modifiedCount: c.updateOne(q, u) }),
      updateMany: async (q, u) => {
        const docs = c.find(q);
        docs.forEach(d => c.updateOne({ _id: d._id }, u));
        return { modifiedCount: docs.length };
      },
      deleteMany: async (q = {}) => ({ deletedCount: c.deleteMany(q) }),
      deleteOne: async (q) => ({ deletedCount: c.deleteOne(q) }),
      countDocuments: async (q = {}) => c.count(q),

      aggregate: async (pipeline) => {
        const _get = (o, k) => {
          const parts = String(k).split('.');
          let cur = o;
          for (const p of parts) {
            if (cur == null) return undefined;
            if (Array.isArray(cur)) {
              cur = cur.map(item => item?.[p]).filter(v => v != null);
              if (cur.length === 0) return undefined;
              if (cur.length === 1) cur = cur[0];
            } else {
              cur = cur[p];
            }
          }
          return cur;
        };

        const _match = (doc, query) => {
          if (!query || typeof query !== 'object') return true;
          return Object.entries(query).every(([k, v]) => {
            if (k === '$or') return v.some(q => _match(doc, q));
            if (k === '$and') return v.every(q => _match(doc, q));
            const dv = _get(doc, k);
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              if ('$in' in v) {
                const inVals = (v.$in || []).map(String);
                if (Array.isArray(dv)) return dv.some(x => inVals.includes(String(x)));
                return inVals.includes(String(dv));
              }
              if ('$ne' in v) return String(dv) !== String(v.$ne);
              if ('$gt' in v) return dv > v.$gt;
              if ('$gte' in v) return dv >= v.$gte;
              if ('$lt' in v) return dv < v.$lt;
              if ('$lte' in v) return dv <= v.$lte;
              if ('$exists' in v) return v.$exists ? dv !== undefined : dv === undefined;
              if ('$regex' in v) return new RegExp(v.$regex, v.$options || '').test(String(dv ?? ''));
            }
            if (v === false && (dv === false || dv === undefined || dv === null)) return true;
            if (v === true && dv !== true) return false;
            if (Array.isArray(dv)) return dv.some(x => String(x) === String(v));
            return String(dv) === String(v);
          });
        };

        let results = [...c.docs];
        for (const stage of pipeline) {
          if (stage.$match) results = results.filter(d => _match(d, stage.$match));

          if (stage.$group) {
            const groups = {};
            results.forEach(doc => {
              const kr = stage.$group._id;
              const kv = typeof kr === 'string' && kr.startsWith('$') ? _get(doc, kr.slice(1)) : kr;
              const key = JSON.stringify(kv);
              if (!groups[key]) groups[key] = { _id: kv };
              Object.entries(stage.$group).forEach(([k, v]) => {
                if (k === '_id') return;
                if (v.$sum !== undefined) {
                  groups[key][k] = (groups[key][k] || 0) +
                    (typeof v.$sum === 'number' ? v.$sum : Number(_get(doc, String(v.$sum).replace('$', ''))) || 0);
                }
                if (v.$count !== undefined) groups[key][k] = (groups[key][k] || 0) + 1;
                if (v.$first !== undefined && groups[key][k] === undefined)
                  groups[key][k] = _get(doc, String(v.$first).replace('$', ''));
                if (v.$push) {
                  if (!groups[key][k]) groups[key][k] = [];
                  const val = typeof v.$push === 'string' && v.$push.startsWith('$')
                    ? _get(doc, v.$push.slice(1)) : v.$push;
                  groups[key][k].push(val);
                }
                if (v.$addToSet) {
                  if (!groups[key][k]) groups[key][k] = [];
                  const val = typeof v.$addToSet === 'string' && v.$addToSet.startsWith('$')
                    ? _get(doc, v.$addToSet.slice(1)) : v.$addToSet;
                  if (!groups[key][k].some(x => String(x) === String(val))) groups[key][k].push(val);
                }
              });
            });
            results = Object.values(groups);
          }

          if (stage.$sort) {
            const [k, v] = Object.entries(stage.$sort)[0];
            results.sort((a, b) => {
              const av = a[k], bv = b[k];
              return v === 1 ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
            });
          }
          if (stage.$limit) results = results.slice(0, stage.$limit);
          if (stage.$skip) results = results.slice(stage.$skip);

          if (stage.$lookup) {
            const fc = col(stage.$lookup.from);
            results = results.map(doc => {
              const lv = doc[stage.$lookup.localField];
              const vals = Array.isArray(lv) ? lv.map(String) : [String(lv)];
              doc[stage.$lookup.as] = fc.docs.filter(fd =>
                vals.includes(String(_get(fd, stage.$lookup.foreignField)))
              );
              return doc;
            });
          }

          if (stage.$unwind) {
            const f = String(stage.$unwind).replace('$', '');
            const out = [];
            results.forEach(doc => {
              if (Array.isArray(doc[f]) && doc[f].length > 0) {
                doc[f].forEach(item => out.push({ ...doc, [f]: item }));
              } else if (doc[f] !== undefined) {
                out.push(doc);
              }
            });
            results = out;
          }

          if (stage.$project) {
            results = results.map(doc => {
              const out = {};
              Object.entries(stage.$project).forEach(([k, v]) => {
                if (v === 1 || v === true) out[k] = doc[k];
                else if (typeof v === 'string' && v.startsWith('$')) out[k] = _get(doc, v.slice(1));
              });
              return out;
            });
          }

          if (stage.$addFields || stage.$set) {
            const fields = stage.$addFields || stage.$set;
            results = results.map(doc => ({ ...doc, ...fields }));
          }
        }
        return results;
      },
    };
  };

  // Override mongoose.model
  const modelCache = {};
  mongoose.model = function(name) {
    const collName = name.toLowerCase() + 's';
    if (!modelCache[collName]) modelCache[collName] = makeModel(collName);
    return modelCache[collName];
  };

  mongoose.models = new Proxy({}, {
    get: (_, name) => typeof name === 'string' ? mongoose.model(name) : undefined,
    has: () => true,
    set: () => true,
  });

  console.log('✅ JsonDB initialized - offline mode (data in backend/data/)');
}

module.exports = connectDB;
