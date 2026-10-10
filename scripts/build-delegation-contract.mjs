#!/usr/bin/env node
/** Generate browser/Node schema data from the single JSON declaration; no runtime semantics. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bytes=fs.readFileSync(path.join(root,'contracts/delegation.schema.json'));
const digest=createHash('sha256').update(bytes).digest('hex');
const text='// Generated from contracts/delegation.schema.json; never edit.\nexport const SCHEMA_DIGEST='+JSON.stringify(digest)+';\nexport const CONTRACT_SCHEMA='+JSON.stringify(JSON.parse(bytes))+';\n';
const target=path.join(root,'contracts/generated/delegation-schema.mjs');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==text)throw Error('DELEGATION_SCHEMA_DRIFT');}
else fs.writeFileSync(target,text);
console.log('DELEGATION_SCHEMA_OK '+digest);
