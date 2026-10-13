import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { addDeletionCalloutToPhp } from './privacy-deletion-callout.mjs';
const [input,output] = process.argv.slice(2);
if(!input||!output||resolve(input)===resolve(output))throw new Error('Usage: node scripts/prepare-privacy-deletion-callout.mjs ORIGINAL.php UPDATED.php');
let source=await readFile(input,'utf8');
source=addDeletionCalloutToPhp(source);
await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,source);
console.log('Prepared deletion callout in German, English and Spanish; policy text preserved.');
