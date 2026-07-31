# FundOS Frontend — gyain deployment (fefundos, 10.130.0.20)

Serve the SPA as **https://fundos.gyain.com** from the dedicated `/d01`
volume, proxying `/api/*` to the backend (befundos, 10.130.0.34) over the
private network. TLS uses the pre-issued wildcard `*.gyain.com` cert.

The app talks to the backend via the relative base `/api/v1` (see
`src/api/client.js`), so **no rebuild is needed per environment** — the
same-origin proxy handles routing. Tenant is resolved by the backend from the
JWT, so one host serves every tenant.

## 1. OS prep
```bash
sudo hostnamectl set-hostname fefundos.gyain.com
echo '10.130.0.20  fefundos.gyain.com fefundos fundos.gyain.com' | sudo tee -a /etc/hosts
sudo systemctl enable --now firewalld
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
sudo setsebool -P httpd_can_network_connect 1
```

## 2. Users & dirs on /d01
```bash
sudo useradd --system --home-dir /d01/fundos-web --create-home --shell /sbin/nologin webdeploy
sudo mkdir -p /d01/fundos-web/releases /var/log/fundos-web
sudo chown -R webdeploy:webdeploy /d01/fundos-web /var/log/fundos-web
```

## 3. Build the release
```bash
sudo dnf -y module enable nodejs:20
sudo dnf -y install nodejs unzip
sudo -u webdeploy mkdir -p /d01/fundos-web/releases/2026-07-10
sudo -u webdeploy unzip -q /tmp/fundos-frontend.zip -d /d01/fundos-web/releases/2026-07-10
cd /d01/fundos-web/releases/2026-07-10
sudo -u webdeploy npm ci --no-fund --no-audit || sudo -u webdeploy npm install --no-fund --no-audit
sudo -u webdeploy npm run build          # emits dist/
```

## 4. Activate
```bash
sudo ln -sfn /d01/fundos-web/releases/2026-07-10/dist /d01/fundos-web/current
sudo semanage fcontext -a -t httpd_sys_content_t "/d01/fundos-web/releases(/.*)?"
sudo restorecon -Rv /d01/fundos-web/releases /d01/fundos-web/current
```

## 5. Wildcard cert + Nginx
```bash
sudo dnf -y install nginx
sudo mkdir -p /etc/pki/gyain
sudo cp /tmp/wildcard.gyain.com.fullchain.pem /etc/pki/gyain/fullchain.pem
sudo cp /tmp/wildcard.gyain.com.privkey.pem   /etc/pki/gyain/privkey.pem
sudo chmod 600 /etc/pki/gyain/privkey.pem
sudo cp deploy/nginx/fundos-app.conf /etc/nginx/conf.d/fundos-app.conf
sudo nginx -t && sudo systemctl enable --now nginx
```

## 6. Verify
```bash
curl -sI https://fundos.gyain.com/ | head -1                                   # HTTP/2 200
curl -sI https://fundos.gyain.com/deals/x/stage/2 | head -1                     # 200 (SPA fallback)
curl -s -o /dev/null -w "%{http_code}\n" https://fundos.gyain.com/api/v1/me/contexts  # 401 (reached Django)
```

## 7. Release / rollback
```bash
# new release
sudo -u webdeploy unzip -q /tmp/fundos-frontend-NEW.zip -d /d01/fundos-web/releases/2026-08-01
cd /d01/fundos-web/releases/2026-08-01
sudo -u webdeploy npm ci --no-fund --no-audit && sudo -u webdeploy npm run build
sudo restorecon -Rv /d01/fundos-web/releases/2026-08-01
sudo ln -sfn /d01/fundos-web/releases/2026-08-01/dist /d01/fundos-web/current
# rollback
sudo ln -sfn /d01/fundos-web/releases/2026-07-10/dist /d01/fundos-web/current
```

## Log files to watch
| Stream | Command |
|---|---|
| Nginx access | `sudo tail -f /var/log/nginx/access.log` |
| Nginx error  | `sudo tail -f /var/log/nginx/error.log` |
| Nginx (systemd) | `journalctl -u nginx -f` |
| Build/deploy | `tail -f /var/log/fundos-web/*.log` |

A 502 on `/api/*` only points at the backend upstream (10.130.0.34:443) —
check Gunicorn on befundos, not this node.
