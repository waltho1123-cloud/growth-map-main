# 基底映像走 Google 的 Docker Hub 鏡像：Zeabur 建置機直拉 docker.io 會被限流（2026-09-08 兩次 429 Too Many Requests）
FROM mirror.gcr.io/library/caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile

# Root landing page
COPY index.html /srv/index.html
COPY favicon.ico /srv/favicon.ico
COPY css /srv/css
COPY js /srv/js
COPY data /srv/data
COPY pages /srv/pages

# Built app outputs only
COPY growthmap/momentum-case/out /srv/growthmap/momentum-case/out
COPY growthmap/aspiration-case/dist /srv/growthmap/aspiration-case/dist
COPY growthmap/opportunity-system/build /srv/growthmap/opportunity-system/build
COPY growthmap/evaluate-strategy/dist /srv/growthmap/evaluate-strategy/dist

EXPOSE 8080
