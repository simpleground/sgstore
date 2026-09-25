// PM2 process file for the VPS.  Start:  pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'sgstore',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '700M',
      env: { NODE_ENV: 'production' },
      time: true,
    },
  ],
};
