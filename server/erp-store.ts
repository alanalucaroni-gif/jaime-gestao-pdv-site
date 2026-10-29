import { commerceDb } from "./commerce-store";
export function records<T>(kind:string):T[] { const db=commerceDb(); db.exec('CREATE TABLE IF NOT EXISTS erp_records (kind TEXT NOT NULL, id INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id))'); return db.prepare('SELECT body FROM erp_records WHERE kind=? ORDER BY id DESC').all(kind).map(r=>JSON.parse(String(r.body))); }
export function put<T extends {id:number}>(kind:string, value:T):T { records(kind); commerceDb().prepare('INSERT INTO erp_records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind,value.id,JSON.stringify(value)); return value; }
export function nextId(kind:string) { return Math.max(0,...records<{id:number}>(kind).map(r=>r.id))+1; }
