FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile

# Root landing page
COPY index.html /srv/index.html
COPY css /srv/css
COPY js /srv/js
COPY data /srv/data
COPY pages /srv/pages

# Built app outputs only
COPY growthmap/momentum-case/out /srv/growthmap/momentum-case/out
COPY growthmap/aspiration-case/dist /srv/growthmap/aspiration-case/dist
COPY growthmap/opportunity-system/build /srv/growthmap/opportunity-system/build

EXPOSE 8080
