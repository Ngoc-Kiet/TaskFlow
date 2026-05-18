/**
 * Model Proxy - tự động chọn Mongoose hoặc JsonDB dựa theo kết nối
 * Thêm các instance methods cần thiết vào JsonDB docs
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ---- Helpers ----
const getAvatarUrl = (user) => {
  if (user.avatar) return user.avatar;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=6366f1&color=fff&size=200`;
};

const addUserMethods = (user) => {
  if (!user || typeof user !== 'object') return user;
  if (typeof user.comparePassword !== 'function') {
    user.comparePassword = async (candidate) => await bcrypt.compare(candidate, user.password);
  }
  if (typeof user.getAvatarUrl !== 'function') {
    user.getAvatarUrl = () => getAvatarUrl(user);
  }
  if (typeof user.save !== 'function') {
    const { col } = require('../config/jsonDb');
    user.save = async () => { col('users').updateOne({ _id: user._id }, { $set: { ...user } }); return user; };
  }
  return user;
};

const wrapFind = (result, addMethods) => {
  if (!result) return null;
  if (Array.isArray(result)) return result.map(addMethods);
  // Handle Query-like objects (has .then)
  if (typeof result.then === 'function') {
    return {
      ...result,
      then: (resolve, reject) => result.then(r => {
        if (Array.isArray(r)) resolve(r.map(addMethods));
        else resolve(r ? addMethods(r) : null);
      }, reject),
      select: (...args) => wrapFind(result.select?.(...args) || result, addMethods),
      populate: (...args) => wrapFind(result.populate?.(...args) || result, addMethods),
      sort: (...args) => wrapFind(result.sort?.(...args) || result, addMethods),
      limit: (...args) => wrapFind(result.limit?.(...args) || result, addMethods),
      skip: (...args) => wrapFind(result.skip?.(...args) || result, addMethods),
      lean: () => wrapFind(result, addMethods),
    };
  }
  return addMethods(result);
};

// ---- User Model Proxy ----
let _MongooseUser = null;
let _JsonDBUser = null;

const getMongooseUser = () => {
  if (!_MongooseUser) _MongooseUser = require('./User');
  return _MongooseUser;
};

const getJsonDBUser = () => {
  if (!_JsonDBUser) {
    const { createModel, col } = require('../config/jsonDb');
    _JsonDBUser = {
      ...createModel('users'),
      findOne: (q) => {
        const c = col('users');
        const doc = c.findOne(q);
        return Promise.resolve(doc ? addUserMethods({ ...doc }) : null);
      },
      find: (q = {}) => {
        const c = col('users');
        return Promise.resolve(c.find(q).map(d => addUserMethods({ ...d })));
      },
      findById: (id) => {
        const c = col('users');
        const doc = c.findOne({ _id: String(id) });
        return Promise.resolve(doc ? addUserMethods({ ...doc }) : null);
      },
      create: async (data) => {
        const c = col('users');
        const hashed = await bcrypt.hash(data.password, 12);
        const doc = c.insertOne({
          ...data,
          email: (data.email || '').toLowerCase(),
          password: hashed,
          role: data.role || 'user',
          isActive: true,
          avatar: data.avatar || ''
        });
        return addUserMethods({ ...doc });
      },
      insertMany: async (arr) => {
        const c = col('users');
        const docs = [];
        for (const data of arr) {
          const hashed = await bcrypt.hash(data.password, 12);
          docs.push(c.insertOne({ ...data, email: (data.email||'').toLowerCase(), password: hashed }));
        }
        return docs.map(d => addUserMethods({ ...d }));
      },
      findByIdAndUpdate: (id, update, opts = {}) => {
        const c = col('users');
        c.updateOne({ _id: String(id) }, update);
        const doc = c.findOne({ _id: String(id) });
        return Promise.resolve(doc ? addUserMethods({ ...doc }) : null);
      },
      findByIdAndDelete: (id) => {
        const c = col('users');
        const doc = c.findOne({ _id: String(id) });
        if (doc) c.deleteOne({ _id: String(id) });
        return Promise.resolve(doc ? addUserMethods({ ...doc }) : null);
      },
      countDocuments: (q = {}) => {
        return Promise.resolve(col('users').count(q));
      },
      deleteMany: async (q = {}) => ({ deletedCount: col('users').deleteMany(q) }),
    };
  }
  return _JsonDBUser;
};

const UserProxy = new Proxy({}, {
  get(_, prop) {
    const model = global.__USE_JSONDB__ ? getJsonDBUser() : getMongooseUser();
    const val = model[prop];
    return typeof val === 'function' ? val.bind(model) : val;
  }
});

module.exports = { UserProxy, addUserMethods };
