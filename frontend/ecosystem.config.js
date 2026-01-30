module.exports = {
    apps: [{
      name: 'dashboard-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/dashboard/frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      },
      error_file: '/var/www/dashboard/frontend/logs/pm2-error.log',
      out_file: '/var/www/dashboard/frontend/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }]
  }