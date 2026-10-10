/** Shared closed-schema seam for Node and read-only webview; no filesystem, host or state access. */
import {CONTRACT_SCHEMA,SCHEMA_DIGEST} from '../../contracts/generated/delegation-schema.mjs';
export {SCHEMA_DIGEST};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function matches(spec,value,path,errors){
 if(spec.$ref)return matches(CONTRACT_SCHEMA.$defs[spec.$ref.slice('#/$defs/'.length)],value,path,errors);
 if(spec.anyOf){if(!spec.anyOf.some(s=>{const e=[];matches(s,value,path,e);return !e.length;}))errors.push(path+': anyOf');return;}
 if(spec.const!==undefined&&value!==spec.const)errors.push(path+': const');
 if(spec.enum&&!spec.enum.includes(value))errors.push(path+': enum');
 if(spec.type){const types=Array.isArray(spec.type)?spec.type:[spec.type];
  const good=types.some(t=>t==='null'?value===null:t==='object'?plain(value):t==='array'?Array.isArray(value):t==='integer'?Number.isSafeInteger(value):typeof value===t);
  if(!good){errors.push(path+': type');return;}}
 if(typeof value==='string'){
  const length=[...value].length;
  if(spec.minLength!==undefined&&length<spec.minLength||spec.maxLength!==undefined&&length>spec.maxLength)errors.push(path+': length');
  if(spec.pattern&&(!new RegExp(spec.pattern,'u').test(value)||/[\r\n\0]/.test(value)&&spec.pattern.startsWith('^')))errors.push(path+': pattern');
  if(spec.format==='date-time'){
   const m=/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.exec(value);
   if(!m||!Number.isFinite(Date.parse(value))||new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).getUTCDate()!==+m[3])errors.push(path+': date-time');
  }
 }
 if(typeof value==='number'&&(spec.minimum!==undefined&&value<spec.minimum||spec.maximum!==undefined&&value>spec.maximum))errors.push(path+': range');
 if(Array.isArray(value)){
  if(spec.minItems!==undefined&&value.length<spec.minItems||spec.maxItems!==undefined&&value.length>spec.maxItems)errors.push(path+': item count');
  if(spec.items)value.forEach((v,i)=>matches(spec.items,v,path+'['+i+']',errors));
 }
 if(plain(value)&&spec.properties){
  for(const key of spec.required||[])if(!Object.hasOwn(value,key))errors.push(path+'.'+key+': missing');
  for(const [key,v] of Object.entries(value)){
   if(Object.hasOwn(spec.properties,key))matches(spec.properties[key],v,path+'.'+key,errors);
   else if(spec.additionalProperties===false)errors.push(path+'.'+key+': unknown');
  }
 }
}
export function assertContract(name,value){
 const schema=CONTRACT_SCHEMA.$defs[name];if(!schema)throw Error('DELEGATION_CONTRACT_INVALID: unknown definition '+name);
 const errors=[];matches(schema,value,name,errors);
 if(errors.length){const error=new Error('DELEGATION_CONTRACT_INVALID: '+errors.join('; '));error.code='INPUT_INVALID';throw error;}
 return value;
}
/** Digest domains use JSON primitives and safe integers; arbitrary project bytes are separately raw-hashed. */
export function canonicalJson(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('SEMANTIC_NUMBER_INVALID');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(plain(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
 throw Error('SEMANTIC_VALUE_INVALID');
}
