import { createClient } from '@libsql/client';
import crypto from 'crypto';

function generateUUID() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return crypto.randomUUID();
}

let tursoClient = null;
let schemaInitialized = false;

function getTursoClient() {
  if (tursoClient) return tursoClient;

  const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_DB_URL || 'libsql://shindora-stream-vercel-icfg-eazhunyycsuthriwkauulqnq.aws-ap-northeast-1.turso.io';
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DB_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg4MzQwNTksImlkIjoiMDFhMDdlZDEtOTAwMS03MmQzLTlhZmMtMzNmMmIwZmRlMjMzIiwia2lkIjoiaWFiWjl1Q21yeGFVanJQTGpnYUZBNlBRNG1xYVc4WURSVkppR3R5TGRuMCIsInJpZCI6IjhjZjdlYmEwLTUzMDEtNDMxNi04NDRhLWI5MTU3Mzk1NjM2NCJ9.ulNsZYKkKzEZ_4WRrVXNipWOBGjELc4Yg6opJ8Y4Yr9zgRDXd21c-o9r6F7-Z23xkRqHQ5yg4xM-Zd7mC7caDQ';

  tursoClient = createClient({
    url,
    authToken
  });
  return tursoClient;
}

const initSqls = [
  `CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    title TEXT,
    slug TEXT UNIQUE,
    originalUrl TEXT,
    posterUrl TEXT,
    sources TEXT,
    subtitles TEXT,
    hostType TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    type TEXT UNIQUE,
    username TEXT,
    password TEXT,
    publicKey TEXT,
    privateKey TEXT,
    urlEndpoint TEXT,
    playerType TEXT,
    autoplay INTEGER,
    vastEnabled INTEGER,
    vastTags TEXT,
    isAdblockEnabled INTEGER,
    cdnUrl TEXT,
    downloadCdnUrl TEXT,
    isCustomDownloadCdnEnabled INTEGER,
    vkServiceToken TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE,
    refreshToken TEXT UNIQUE,
    username TEXT,
    expiresAt TEXT,
    refreshExpiresAt TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS status_checks (
    id TEXT PRIMARY KEY,
    client_name TEXT,
    timestamp TEXT
  );`
];

async function ensureSchema() {
  if (schemaInitialized) return;
  const client = getTursoClient();
  for (const sql of initSqls) {
    try {
      await client.execute(sql);
    } catch (e) {
      console.warn('[Turso Schema Init Warn]:', e.message);
    }
  }
  // Try adding optional columns if table already existed without them
  try { await client.execute('ALTER TABLE links ADD COLUMN subtitles TEXT;'); } catch (e) {}
  try { await client.execute('ALTER TABLE settings ADD COLUMN isAdblockEnabled INTEGER;'); } catch (e) {}
  try { await client.execute('ALTER TABLE settings ADD COLUMN downloadCdnUrl TEXT;'); } catch (e) {}
  try { await client.execute('ALTER TABLE settings ADD COLUMN isCustomDownloadCdnEnabled INTEGER;'); } catch (e) {}
  try { await client.execute('ALTER TABLE settings ADD COLUMN vkServiceToken TEXT;'); } catch (e) {}
  try { await client.execute('ALTER TABLE sessions ADD COLUMN refreshToken TEXT;'); } catch (e) {}
  try { await client.execute('ALTER TABLE sessions ADD COLUMN refreshExpiresAt TEXT;'); } catch (e) {}
  try { await client.execute('ALTER TABLE sessions ADD COLUMN createdAt TEXT;'); } catch (e) {}
  try { await client.execute('ALTER TABLE sessions ADD COLUMN updatedAt TEXT;'); } catch (e) {}
  schemaInitialized = true;
}

async function executeQuery(sql, params = []) {
  const client = getTursoClient();
  const res = await client.execute({ sql, args: params });
  return (res.rows || []).map((row) => {
    const obj = {};
    for (const col of res.columns) {
      obj[col] = row[col];
    }
    return obj;
  });
}

function parseFilter(filter) {
  if (!filter || Object.keys(filter).length === 0) {
    return { where: "1=1", params: [] };
  }

  const conditions = [];
  const params = [];

  for (const key of Object.keys(filter)) {
    if (key === '$or') {
      const orConditions = filter['$or'];
      const orClauses = [];
      for (const subFilter of orConditions) {
        const subParsed = parseFilter(subFilter);
        orClauses.push(`(${subParsed.where})`);
        params.push(...subParsed.params);
      }
      conditions.push(`(${orClauses.join(' OR ')})`);
    } else {
      const val = filter[key];
      if (val instanceof RegExp) {
        const parts = val.source.split('|');
        const likeClauses = parts.map(part => {
          const pattern = part.replace(/\\/g, '').replace(/^\^/, '').replace(/\$$/, '');
          params.push(`%${pattern}%`);
          return `${key} LIKE ?`;
        });
        conditions.push(`(${likeClauses.join(' OR ')})`);
      } else if (typeof val === 'object' && val !== null) {
        conditions.push(`${key} = ?`);
        params.push(JSON.stringify(val));
      } else {
        conditions.push(`${key} = ?`);
        params.push(val);
      }
    }
  }

  return {
    where: conditions.length > 0 ? conditions.join(' AND ') : "1=1",
    params
  };
}

function serializeDoc(table, doc) {
  if (!doc) return doc;
  const serialized = { ...doc };
  
  if ('_id' in serialized) delete serialized._id;

  if (table === 'links') {
    if ('sources' in serialized) serialized.sources = JSON.stringify(serialized.sources || []);
    if ('subtitles' in serialized) serialized.subtitles = JSON.stringify(serialized.subtitles || []);
  }
  if (table === 'settings') {
    if ('vastTags' in serialized) serialized.vastTags = JSON.stringify(serialized.vastTags || []);
    if ('autoplay' in serialized) serialized.autoplay = serialized.autoplay ? 1 : 0;
    if ('vastEnabled' in serialized) serialized.vastEnabled = serialized.vastEnabled ? 1 : 0;
    if ('isAdblockEnabled' in serialized) serialized.isAdblockEnabled = serialized.isAdblockEnabled ? 1 : 0;
    if ('isCustomDownloadCdnEnabled' in serialized) serialized.isCustomDownloadCdnEnabled = serialized.isCustomDownloadCdnEnabled ? 1 : 0;
  }

  for (const key of Object.keys(serialized)) {
    if (serialized[key] instanceof Date) {
      serialized[key] = serialized[key].toISOString();
    }
  }

  return serialized;
}

function deserializeDoc(table, row) {
  if (!row) return row;
  const deserialized = { ...row };

  if (table === 'links') {
    if ('sources' in deserialized && typeof deserialized.sources === 'string') {
      try {
        deserialized.sources = JSON.parse(deserialized.sources);
      } catch (e) {
        deserialized.sources = [];
      }
    } else if (!deserialized.sources) {
      deserialized.sources = [];
    }

    if ('subtitles' in deserialized && typeof deserialized.subtitles === 'string') {
      try {
        deserialized.subtitles = JSON.parse(deserialized.subtitles);
      } catch (e) {
        deserialized.subtitles = [];
      }
    } else if (!deserialized.subtitles) {
      deserialized.subtitles = [];
    }
  }

  if (table === 'settings') {
    if ('vastTags' in deserialized && typeof deserialized.vastTags === 'string') {
      try {
        deserialized.vastTags = JSON.parse(deserialized.vastTags);
      } catch (e) {
        deserialized.vastTags = [];
      }
    }
    if ('autoplay' in deserialized) {
      deserialized.autoplay = deserialized.autoplay === 1;
    }
    if ('vastEnabled' in deserialized) {
      deserialized.vastEnabled = deserialized.vastEnabled === 1;
    }
    if ('isAdblockEnabled' in deserialized) {
      deserialized.isAdblockEnabled = deserialized.isAdblockEnabled === 1;
    }
    if ('isCustomDownloadCdnEnabled' in deserialized) {
      deserialized.isCustomDownloadCdnEnabled = deserialized.isCustomDownloadCdnEnabled === 1;
    }
  }

  if ('createdAt' in deserialized && typeof deserialized.createdAt === 'string') {
    deserialized.createdAt = new Date(deserialized.createdAt);
  }
  if ('updatedAt' in deserialized && typeof deserialized.updatedAt === 'string') {
    deserialized.updatedAt = new Date(deserialized.updatedAt);
  }
  if ('expiresAt' in deserialized && typeof deserialized.expiresAt === 'string') {
    deserialized.expiresAt = new Date(deserialized.expiresAt);
  }
  if ('refreshExpiresAt' in deserialized && typeof deserialized.refreshExpiresAt === 'string') {
    deserialized.refreshExpiresAt = new Date(deserialized.refreshExpiresAt);
  }
  if ('createdAt' in deserialized && typeof deserialized.createdAt === 'string') {
    deserialized.createdAt = new Date(deserialized.createdAt);
  }
  if ('timestamp' in deserialized && typeof deserialized.timestamp === 'string') {
    deserialized.timestamp = new Date(deserialized.timestamp);
  }

  return deserialized;
}

async function insertOne(table, doc) {
  const serialized = serializeDoc(table, doc);
  if (!serialized.id) {
    serialized.id = generateUUID();
  }
  const keys = Object.keys(serialized);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  await executeQuery(sql, keys.map(k => serialized[k]));
  return { insertedId: serialized.id };
}

async function updateOne(table, filter, update, options = {}) {
  const { where, params } = parseFilter(filter);
  let setObj = update.$set || update;
  const serialized = serializeDoc(table, setObj);

  if (options?.upsert) {
    const checkSql = `SELECT * FROM ${table} WHERE ${where} LIMIT 1`;
    const checkRows = await executeQuery(checkSql, params);
    
    if (checkRows.length === 0) {
      const newDoc = { ...filter, ...serialized };
      if (!newDoc.id) {
        newDoc.id = generateUUID();
      }
      await insertOne(table, newDoc);
      return { upsertedCount: 1 };
    }
  }

  const keys = Object.keys(serialized).filter(k => k !== 'id' && k !== 'type');
  if (keys.length === 0) return { modifiedCount: 0 };

  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  const updateParams = [...keys.map(k => serialized[k]), ...params];
  
  await executeQuery(sql, updateParams);
  return { modifiedCount: 1 };
}

async function replaceOne(table, filter, doc) {
  const { where, params } = parseFilter(filter);
  const serialized = serializeDoc(table, doc);
  
  const keys = Object.keys(serialized).filter(k => k !== 'id');
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  
  const updateParams = [...keys.map(k => serialized[k]), ...params];
  await executeQuery(sql, updateParams);
  return { modifiedCount: 1 };
}

export async function getDb() {
  await ensureSchema();
  
  return {
    collection: (name) => {
      return {
        countDocuments: async (filter = {}) => {
          const { where, params } = parseFilter(filter);
          const sql = `SELECT COUNT(*) as count FROM ${name} WHERE ${where}`;
          const rows = await executeQuery(sql, params);
          return rows[0]?.count || 0;
        },
        find: (filter = {}) => {
          let sortClause = '';
          let limitNum = -1;
          
          const chain = {
            sort: (sortObj = {}) => {
              const keys = Object.keys(sortObj);
              if (keys.length > 0) {
                const dir = sortObj[keys[0]] === -1 ? 'DESC' : 'ASC';
                sortClause = ` ORDER BY ${keys[0]} ${dir}`;
              }
              return chain;
            },
            limit: (num) => {
              limitNum = num;
              return chain;
            },
            toArray: async () => {
              const { where, params } = parseFilter(filter);
              let sql = `SELECT * FROM ${name} WHERE ${where}${sortClause}`;
              if (limitNum > 0) {
                sql += ` LIMIT ${limitNum}`;
              }
              const rows = await executeQuery(sql, params);
              return rows.map((row) => deserializeDoc(name, row));
            }
          };
          return chain;
        },
        findOne: async (filter = {}) => {
          const { where, params } = parseFilter(filter);
          const sql = `SELECT * FROM ${name} WHERE ${where} LIMIT 1`;
          const rows = await executeQuery(sql, params);
          if (rows.length === 0) return null;
          return deserializeDoc(name, rows[0]);
        },
        insertOne: async (doc) => {
          return await insertOne(name, doc);
        },
        insertMany: async (docs) => {
          if (!Array.isArray(docs) || docs.length === 0) return { insertedCount: 0 };
          for (const doc of docs) {
            await insertOne(name, doc);
          }
          return { insertedCount: docs.length };
        },
        updateOne: async (filter, update, options) => {
          return await updateOne(name, filter, update, options);
        },
        replaceOne: async (filter, doc) => {
          return await replaceOne(name, filter, doc);
        },
        deleteOne: async (filter) => {
          const { where, params } = parseFilter(filter);
          const sql = `DELETE FROM ${name} WHERE ${where}`;
          await executeQuery(sql, params);
          return { deletedCount: 1 };
        }
      };
    }
  };
}
