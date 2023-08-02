FROM alpine:3.17 as builder

ARG ZT_PORT

ENV TZ=Asia/Shanghai

WORKDIR /app
ADD . /app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories \
    && apk update\
    && mkdir -p /usr/include/nlohmann/ && cd /usr/include/nlohmann/ && wget https://ghself.markxu.online/https://github.com/nlohmann/json/releases/download/v3.10.5/json.hpp \
    && apk add --no-cache git python3 npm make g++ zerotier-one linux-headers\
    && mkdir /app -p &&  cd /app && git clone --progress https://ghself.markxu.online/https://github.com/key-networks/ztncui.git\
    && cd /app/ztncui/src \
    && cp /app/patch/binding.gyp .\
    && echo "开始配置npm环境"\
    && npm install -g --progress --verbose node-gyp --registry=https://registry.npmmirror.com\
    && npm install  --registry=https://registry.npmmirror.com\
    && echo 'HTTP_PORT=3443' >.env \
    && echo 'NODE_ENV=production' >>.env \
    && echo 'HTTP_ALL_INTERFACES=true' >>.env \
    && echo "ZT_ADDR=localhost:${ZT_PORT}" >>.env\
    && echo "${ZT_PORT}" >/app/zerotier-one.port \
    && cp -v etc/default.passwd etc/passwd

RUN cd /app && git clone --progress https://ghself.markxu.online/https://github.com/zerotier/ZeroTierOne.git --depth 1\
    && zerotier-one -d && sleep 5s && ps -ef |grep zerotier-one |grep -v grep |awk '{print $1}' |xargs kill -9 \
    && cd /var/lib/zerotier-one && zerotier-idtool initmoon identity.public >moon.json\
    && cd /app/patch && python3 patch.py \
    && cd /var/lib/zerotier-one && zerotier-idtool genmoon moon.json && mkdir moons.d && cp ./*.moon ./moons.d \
    && cd /app/ZeroTierOne/attic/world/ && sh build.sh \
    && sleep 5s \
    && cd /app/ZeroTierOne/attic/world/ && ./mkworld \
    && mkdir /app/bin -p && cp world.bin /app/bin/planet \
    && TOKEN=$(cat /var/lib/zerotier-one/authtoken.secret) \
    && echo "ZT_TOKEN=$TOKEN">> /app/ztncui/src/.env 

FROM node:lts-alpine as frontend-build

ENV INLINE_RUNTIME_CHUNK=false
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /app/frontend
COPY yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/
COPY ./frontend/package*.json /app/frontend
RUN yarn install

COPY ./frontend /app/frontend
RUN yarn build

FROM alpine:3.17

WORKDIR /app/frontend/build

COPY --from=frontend-build /app/frontend/build /app/frontend/build/

WORKDIR /app/backend

COPY yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/
COPY ./backend/package*.json /app/backend
RUN yarn install

COPY ./backend /app/backend

WORKDIR /app

COPY --from=builder /app/bin /app/bin
COPY --from=builder /app/zerotier-one.port /app/zerotier-one.port
COPY --from=builder /var/lib/zerotier-one /var/lib/zerotier-one

RUN echo "开始配置npm环境"\
    && npm install -g --progress --verbose node-gyp --registry=https://registry.npmmirror.com\
    && npm install  --registry=https://registry.npmmirror.com\

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories \
    && apk update\
    && apk add --no-cache npm zerotier-one

ENV NODE_ENV=production
ENV ZU_SECURE_HEADERS=true
ENV ZU_SERVE_FRONTEND=true

VOLUME [ "/app","/var/lib/zerotier-one" ]

CMD /bin/sh -c "cd /var/lib/zerotier-one && ./zerotier-one -p`cat /app/zerotier-one.port` -d;node ./backend/bin/www"
