# Routes

TODO: This document is outdated, might get updated again at some point.
Everything under /api should be a json api and oauth should have its own
subfolder.

## No user or IP parsing neccessary:

```
GET /chunks/[canvasId]/[x]/[y].bmp
```

Binary base chunks.

```
GET /tiles/[canvasId]/[zoom]/[x]/[y].webp
```

Zoomed Tiles.

```
GET /
```

Assets

```
GET /guilded
```

Guilded / Discord redirect

```
GET /adminapi
AUTHORIZATION: [APISOCKET_KEY]
```

Random admin interface

## Translation available

```
GET /globe
GET /[popup name]
GET /
```

Main sites, server rendered html stub

```
GET /reset_password?email=[email]&token=[token_uuid]
POST /reset_password
```

Password reset interface

## CORS headers set

```
GET /void
```

void info

```
GET /ranking
```

statistics

```
GET /history?day=[date]&id=[canvasId]
```

history times available for date

```
GET /captcha.svg
```

captcha

```
GET /shards
```

stats to running shards

```
GET /api/getiid
```

## User available if logged in

```
GET /chathistory
```

```
GET /me
```

```
GET /baninfo
```

```
GET /banme
```

```
GET /api/auth/[oauth_provider]
```

oauth callback

```
GET /api/auth/logout
```

```
GET /api/auth/resend_verify
```

```
POST /api/auth/change_passwd
```

```
POST /api/auth/change_name
```

```
POST /api/auth/change_mail
```

```
POST /api/auth/delete_account
```

```
POST /api/auth/restore_password
```

```
POST /api/auth/register
```

```
POST /api/auth/local
```

## requires logged in user

```
POST /startdm
```

```
POST /leavechan
```

```
POST /block
```

```
POST /blockdm
```

```
POST /privatize
```
