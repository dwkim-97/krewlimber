import {resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {config} from 'dotenv';
import {createAccount} from '../server/auth';
import {openDatabase} from '../server/db';
import {environmentFile} from '../server/environment';
import {usernameSchema, passwordSchema, nicknameSchema} from '../server/validation';
import {readPassword} from './read-password';

config({path: resolve(environmentFile(process.env)), quiet: true});
if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
const reader = createInterface({input: process.stdin, output: process.stdout});
let username: string;
let nickname: string;
try {
  username = usernameSchema.parse(await reader.question('관리자 아이디: '));
  nickname = nicknameSchema.parse(await reader.question('닉네임: '));
} finally {
  reader.close();
}
const password = passwordSchema.parse(await readPassword('비밀번호 (12자 이상, 화면에 표시되지 않음): '));
if (password !== (await readPassword('비밀번호 확인: '))) throw new Error('Passwords do not match.');
const db = openDatabase(process.env.DATABASE_PATH ?? './data/krewlimber.sqlite');
try {
  await createAccount(db, {username, nickname, password, role: 'admin', status: 'approved'});
  console.log(`관리자 @${username} 생성 완료. 로그인 화면에서 접속할 수 있습니다.`);
} finally {
  db.close();
}
