-- 站点留言表。
--
-- scope + thread 是分区键：文章留言用 ('post', '<slug>')，独立留言板用 ('guest', 'guest')。
-- 这样两种留言天然隔离，列表查询永远只扫一个分区，不需要额外过滤。

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,
  thread      TEXT NOT NULL,
  -- 楼中楼先不做，字段留着：以后要开回复，只改查询，不用迁移数据
  parent_id   TEXT,
  author_id   TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_url  TEXT,
  provider    TEXT NOT NULL DEFAULT 'anon',
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ok',
  ip_hash     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- 列表查询的唯一入口：一个分区里按时间倒序取一页
CREATE INDEX IF NOT EXISTS idx_comments_thread
  ON comments (scope, thread, status, created_at DESC);

-- 限流：按 IP 统计最近 N 秒写了多少条
CREATE INDEX IF NOT EXISTS idx_comments_ip
  ON comments (ip_hash, created_at DESC);

-- 「我留下的」
CREATE INDEX IF NOT EXISTS idx_comments_author
  ON comments (author_id, created_at DESC);
