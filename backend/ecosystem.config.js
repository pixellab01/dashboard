module.exports = {
  apps: [{
    name: 'dashboard-backend',
    script: 'uvicorn',
    args: 'backend.main:app --host 0.0.0.0 --port 8000 --workers 6',
    cwd: '/var/www/dashboard',
    interpreter: 'python3',
    instances: 1,
    exec_mode: 'fork',
    env: {
      PYTHONPATH: '/var/www/dashboard',
      PYTHONUNBUFFERED: '1'
    },
    error_file: '/var/www/dashboard/backend/logs/pm2-error.log',
    out_file: '/var/www/dashboard/backend/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}