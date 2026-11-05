export function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const input = process.stdin;
    const previousRaw = input.isRaw;
    let password = '';
    function finish() {
      input.setRawMode(previousRaw);
      input.off('data', handleData);
      input.pause();
      process.stdout.write('\n');
    }
    function handleData(chunk: Buffer) {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004') {
          finish();
          reject(new Error('Cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          resolve(password);
          return;
        }
        if (character === '\u007f' || character === '\b') password = password.slice(0, -1);
        else if (character >= ' ') password += character;
      }
    }
    input.setRawMode(true);
    input.resume();
    input.on('data', handleData);
  });
}
