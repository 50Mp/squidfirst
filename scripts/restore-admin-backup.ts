import {resolve} from 'node:path';import {restoreScratch} from '../src/operations/backup.js';
const [archive,destination]=process.argv.slice(2);if(!archive||!destination||!process.env.ADMIN_BACKUP_KEY)throw Error('Usage: node --env-file-if-exists=.env --import tsx scripts/restore-admin-backup.ts <archive.sqb> <NEW scratch directory>');
const result=await restoreScratch(resolve(archive),process.env.ADMIN_BACKUP_KEY,resolve(destination));console.log('Restored isolated scratch copy; no workers or Telegram connections started.',result);
