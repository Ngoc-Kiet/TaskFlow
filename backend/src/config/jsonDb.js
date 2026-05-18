/**
 * JsonDB Model Factory
 * Tương thích hoàn toàn với Mongoose Model API
 * Chạy offline - lưu data vào file JSON trong thư mục /data
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// --- ObjectId ---
class ObjectId {
  constructor(id) {
    this.id = id || crypto.randomBytes(12).toString('hex');
  }
  toString() { return this.id; }
  toJSON() { return this.id; }
  equals(other) {
    const s = other?.toString?.() || other;
    return this.id === s;
  }
  static isValid(id) {
    return !!id && (typeof id === 'string' ? id.length === 24 : id instanceof ObjectId);
  }
}

// --- Collection ---
class Collection {
  constructor(name) {
    this.name = name;
    this.file = path.join(DB_DIR, `${name}.json`);
    this.docs = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.file)) {
        this.docs = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } else {
        this._save();
      }
    } catch { this.docs = []; }
  }

  _save() {
    fs.writeFileSync(this.file, JSON.stringify(this.docs, null, 2));
  }

  // Deep get - hỗ trợ cả nested objects VÀ array of objects
  // vd: 'members.user' trên [{user: 'abc', role: 'admin'}] → ['abc']
  _get(obj, key) {
    const parts = key.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      if (Array.isArray(current)) {
        // Extract field from each element of array
        current = current.map(item => item?.[part]).filter(v => v != null);
        if (current.length === 0) return undefined;
        if (current.length === 1) current = current[0];
      } else {
        current = current[part];
      }
    }
    return current;
  }

  // Match a single doc against a query
  _match(doc, query) {
    if (!query || typeof query !== 'object') return true;
    return Object.entries(query).every(([k, v]) => {
      if (k === '$or') return v.some(q => this._match(doc, q));
      if (k === '$and') return v.every(q => this._match(doc, q));
      const dv = this._get(doc, k);
      if (v !== null && typeof v === 'object' && !(v instanceof ObjectId)) {
        if ('$in' in v) {
          const inVals = (v.$in || []).map(String);
          if (Array.isArray(dv)) return dv.some(x => inVals.includes(String(x)));
          return inVals.includes(String(dv));
        }
        if ('$nin' in v) {
          const ninVals = (v.$nin || []).map(String);
          if (Array.isArray(dv)) return !dv.some(x => ninVals.includes(String(x)));
          return !ninVals.includes(String(dv));
        }
        if ('$ne' in v) return String(dv) !== String(v.$ne);
        if ('$gt' in v) return dv > v.$gt;
        if ('$gte' in v) return dv >= v.$gte;
        if ('$lt' in v) return dv < v.$lt;
        if ('$lte' in v) return dv <= v.$lte;
        if ('$exists' in v) return v.$exists ? dv !== undefined : dv === undefined;
        if ('$regex' in v) return new RegExp(v.$regex, v.$options || '').test(String(dv ?? ''));
      }
      // Array field: check if any element matches
      if (Array.isArray(dv)) return dv.some(x => String(x) === String(v));
      // Boolean: undefined/null == false trong MongoDB
      if (v === false && (dv === false || dv === undefined || dv === null)) return true;
      if (v === true && dv !== true) return false;
      return String(dv) === String(v);
    });
  }


  // Apply update operators to doc
  _applyUpdate(doc, update) {
    let finalUpdate = update;
    const hasOp = Object.keys(update).some(k => k.startsWith('$'));
    if (!hasOp) {
      finalUpdate = { $set: update };
    }
    if (finalUpdate.$set) {
      Object.entries(finalUpdate.$set).forEach(([k, v]) => {
        const parts = k.split('.');
        let obj = doc;
        parts.slice(0, -1).forEach(p => { obj[p] = obj[p] || {}; obj = obj[p]; });
        obj[parts[parts.length - 1]] = v;
      });
    }
    if (finalUpdate.$unset) Object.keys(finalUpdate.$unset).forEach(k => delete doc[k]);
    if (finalUpdate.$inc) Object.entries(finalUpdate.$inc).forEach(([k, v]) => { doc[k] = (doc[k] || 0) + v; });
    if (finalUpdate.$push) {
      Object.entries(finalUpdate.$push).forEach(([k, v]) => {
        if (!Array.isArray(doc[k])) doc[k] = [];
        if (v?.$each) doc[k].push(...v.$each);
        else doc[k].push(v);
      });
    }
    if (finalUpdate.$pull) {
      Object.entries(finalUpdate.$pull).forEach(([k, v]) => {
        if (Array.isArray(doc[k])) {
          doc[k] = doc[k].filter(item => !this._match({ _: item }, { _: v }));
        }
      });
    }
    if (update.$addToSet) {
      Object.entries(update.$addToSet).forEach(([k, v]) => {
        if (!Array.isArray(doc[k])) doc[k] = [];
        if (!doc[k].some(x => String(x) === String(v))) doc[k].push(v);
      });
    }
  }

  // --- CRUD methods ---
  find(query = {}) {
    return this.docs.filter(d => this._match(d, query));
  }

  findOne(query = {}) {
    return this.docs.find(d => this._match(d, query)) || null;
  }

  insertOne(data) {
    const doc = {
      ...data,
      _id: data._id || new ObjectId().toString(),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.docs.push(doc);
    this._save();
    return doc;
  }

  updateOne(query, update) {
    const doc = this.docs.find(d => this._match(d, query));
    if (!doc) return 0;
    this._applyUpdate(doc, update);
    doc.updatedAt = new Date().toISOString();
    this._save();
    return 1;
  }

  deleteOne(query) {
    const idx = this.docs.findIndex(d => this._match(d, query));
    if (idx === -1) return 0;
    this.docs.splice(idx, 1);
    this._save();
    return 1;
  }

  deleteMany(query) {
    const before = this.docs.length;
    this.docs = this.docs.filter(d => !this._match(d, query));
    this._save();
    return before - this.docs.length;
  }

  count(query = {}) {
    return this.docs.filter(d => this._match(d, query)).length;
  }
}

// Singleton store
const store = {};
const col = name => {
  if (!store[name]) store[name] = new Collection(name);
  return store[name];
};

// --- Mongoose-compatible Model Factory ---
function createModel(collectionName, schema = {}) {
  const c = col(collectionName);

  // Apply defaults and virtuals from schema
  const applyDefaults = (data) => {
    const doc = { ...data };
    Object.entries(schema).forEach(([k, def]) => {
      if (doc[k] === undefined && def.default !== undefined) {
        doc[k] = typeof def.default === 'function' ? def.default() : def.default;
      }
      if (def.required && (doc[k] === undefined || doc[k] === null)) {
        // skip required validation for simplicity
      }
    });
    return doc;
  };

  // Populate helper - replace ID ref with full object
  const populateField = (docs, field, refCollection) => {
    const rc = col(refCollection);
    return docs.map(doc => {
      const val = doc[field];
      if (!val) return doc;
      if (Array.isArray(val)) {
        doc[field] = val.map(id => rc.findOne({ _id: String(id) }) || id);
      } else {
        doc[field] = rc.findOne({ _id: String(val) }) || val;
      }
      return doc;
    });
  };

  class Query {
    constructor(docs, collRef) {
      this._docs = [...docs];
      this._col = collRef;
      this._populates = [];
      this._sort = null;
      this._skip = 0;
      this._limit = null;
      this._select = null;
    }

    sort(s) { this._sort = s; return this; }
    skip(n) { this._skip = n; return this; }
    limit(n) { this._limit = n; return this; }
    select(s) { this._select = s; return this; }

    populate(field, select) {
      this._populates.push({ field, select });
      return this;
    }

    lean() { return this; }

    _resolve() {
      let results = [...this._docs];

      // Sort
      if (this._sort) {
        const [key, dir] = Object.entries(this._sort)[0];
        results.sort((a, b) => {
          const va = a[key], vb = b[key];
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return dir === -1 || dir === 'desc' ? -cmp : cmp;
        });
      }

      // Skip / Limit
      if (this._skip) results = results.slice(this._skip);
      if (this._limit) results = results.slice(0, this._limit);

      // Populate
      this._populates.forEach(({ field }) => {
        const refName = (schema[field]?.ref || schema[field]?.[0]?.ref || '').toLowerCase() + 's';
        if (refName && refName !== 's') {
          results = populateField(results, field, refName);
        }
      });

      // Deep clone to avoid mutation
      return JSON.parse(JSON.stringify(results));
    }

    then(resolve, reject) {
      try { resolve(this._resolve()); } catch (e) { reject(e); }
      return this;
    }

    catch(reject) { return this; }
    [Symbol.toStringTag]() { return 'Query'; }
  }

  // Single doc Query wrapper
  class DocQuery extends Query {
    _resolve() {
      const results = super._resolve();
      return results[0] || null;
    }
  }

  // Document instance (for new Model(data))
  class Document {
    constructor(data) {
      Object.assign(this, applyDefaults(data));
      if (!this._id) this._id = new ObjectId().toString();
    }

    async save() {
      const existing = c.findOne({ _id: this._id });
      if (existing) {
        c.updateOne({ _id: this._id }, { $set: { ...this } });
      } else {
        c.insertOne({ ...this });
      }
      return this;
    }

    async remove() {
      c.deleteOne({ _id: this._id });
      return this;
    }

    toObject() { return { ...this }; }
    toJSON() { return { ...this }; }
  }

  // Static Model methods
  const Model = {
    modelName: collectionName,

    find(query = {}) {
      const docs = c.find(query);
      return new Query(docs, c);
    },

    findOne(query = {}) {
      const doc = c.findOne(query);
      return new DocQuery(doc ? [doc] : [], c);
    },

    findById(id) {
      return this.findOne({ _id: String(id) });
    },

    async create(data) {
      if (Array.isArray(data)) {
        return data.map(d => c.insertOne(applyDefaults(d)));
      }
      return c.insertOne(applyDefaults(data));
    },

    async insertMany(arr) {
      return arr.map(d => c.insertOne(applyDefaults(d)));
    },

    findByIdAndUpdate(id, update, opts = {}) {
      const doc = c.findOne({ _id: String(id) });
      if (!doc) {
        if (opts.upsert) {
          const newDoc = applyDefaults({ _id: String(id), ...update.$set });
          c.insertOne(newDoc);
          return new DocQuery([newDoc], c);
        }
        return new DocQuery([], c);
      }
      const before = { ...doc };
      c.updateOne({ _id: String(id) }, update);
      const after = c.findOne({ _id: String(id) });
      const result = opts.new ? after : before;
      return new DocQuery(result ? [result] : [], c);
    },

    findOneAndUpdate(query, update, opts = {}) {
      const doc = c.findOne(query);
      if (!doc) {
        if (opts.upsert) {
          const newDoc = applyDefaults({ _id: new ObjectId().toString(), ...(update.$set || {}) });
          c.insertOne(newDoc);
          return new DocQuery([newDoc], c);
        }
        return new DocQuery([], c);
      }
      c.updateOne(query, update);
      const after = c.findOne(query);
      const result = opts.new !== false ? after : doc;
      return new DocQuery(result ? [result] : [], c);
    },

    findByIdAndDelete(id) {
      const doc = c.findOne({ _id: String(id) });
      if (doc) c.deleteOne({ _id: String(id) });
      return new DocQuery(doc ? [doc] : [], c);
    },

    async deleteMany(query = {}) {
      return { deletedCount: c.deleteMany(query) };
    },

    async deleteOne(query) {
      return { deletedCount: c.deleteOne(query) };
    },

    async updateOne(query, update) {
      return { modifiedCount: c.updateOne(query, update) };
    },

    async updateMany(query, update) {
      const docs = c.find(query);
      let count = 0;
      docs.forEach(doc => {
        c.updateOne({ _id: doc._id }, update);
        count++;
      });
      return { modifiedCount: count };
    },

    async countDocuments(query = {}) {
      return c.count(query);
    },

    async aggregate(pipeline) {
      let results = [...c.docs];
      for (const stage of pipeline) {
        if (stage.$match) {
          const m = new Collection('_tmp');
          m.docs = results;
          results = results.filter(d => m._match(d, stage.$match));
        }
        if (stage.$group) {
          const groups = {};
          const tmp = new Collection('_tmp');
          tmp.docs = results;
          results.forEach(doc => {
            let keyVal = stage.$group._id;
            if (typeof keyVal === 'string' && keyVal.startsWith('$')) {
              keyVal = tmp._get(doc, keyVal.slice(1));
            } else if (keyVal && typeof keyVal === 'object') {
              keyVal = Object.fromEntries(
                Object.entries(keyVal).map(([k, v]) =>
                  [k, typeof v === 'string' && v.startsWith('$') ? tmp._get(doc, v.slice(1)) : v]
                )
              );
            }
            const key = JSON.stringify(keyVal);
            if (!groups[key]) {
              groups[key] = { _id: keyVal };
              Object.entries(stage.$group).forEach(([k, v]) => {
                if (k === '_id') return;
                if (v.$sum !== undefined) groups[key][k] = 0;
                if (v.$count !== undefined) groups[key][k] = 0;
                if (v.$push !== undefined) groups[key][k] = [];
                if (v.$first !== undefined) groups[key][k] = undefined;
                if (v.$avg !== undefined) { groups[key][k] = 0; groups[key][`_${k}_cnt`] = 0; }
              });
            }
            Object.entries(stage.$group).forEach(([k, v]) => {
              if (k === '_id') return;
              const field = typeof v.$sum === 'string' ? v.$sum.replace('$', '') : null;
              if (v.$sum !== undefined) groups[key][k] += field ? (Number(tmp._get(doc, field)) || 0) : (v.$sum || 0);
              if (v.$count !== undefined) groups[key][k]++;
              if (v.$push !== undefined) groups[key][k].push(tmp._get(doc, String(v.$push).replace('$', '')));
              if (v.$first !== undefined && groups[key][k] === undefined) groups[key][k] = tmp._get(doc, String(v.$first).replace('$', ''));
            });
          });
          results = Object.values(groups);
        }
        if (stage.$sort) {
          const [key, dir] = Object.entries(stage.$sort)[0];
          results.sort((a, b) => {
            const va = a[key], vb = b[key];
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return dir === -1 ? -cmp : cmp;
          });
        }
        if (stage.$limit) results = results.slice(0, stage.$limit);
        if (stage.$skip) results = results.slice(stage.$skip);
        if (stage.$project) {
          results = results.map(doc => {
            const out = {};
            Object.entries(stage.$project).forEach(([k, v]) => {
              if (v === 1 || v === true) out[k] = doc[k];
            });
            return out;
          });
        }
        if (stage.$lookup) {
          const fc = col(stage.$lookup.from);
          results = results.map(doc => {
            const localVal = doc[stage.$lookup.localField];
            const vals = Array.isArray(localVal) ? localVal : [localVal];
            doc[stage.$lookup.as] = fc.docs.filter(fd =>
              vals.some(v => String(v) === String(fd[stage.$lookup.foreignField]))
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
            } else if (!(stage.$unwind?.preserveNullAndEmptyArrays === false)) {
              out.push(doc);
            }
          });
          results = out;
        }
        if (stage.$addFields) {
          results = results.map(doc => ({ ...doc, ...stage.$addFields }));
        }
      }
      return results;
    },

    // Constructor for `new Model(data)`
    new(data) { return new Document(data); },
  };

  // Make `new Model(data)` work
  const ModelClass = function(data) {
    return new Document(data);
  };
  Object.assign(ModelClass, Model);
  ModelClass.prototype = Document.prototype;

  return ModelClass;
}

module.exports = { createModel, ObjectId, col };
