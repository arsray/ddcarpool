#!/usr/bin/env bash
# 将同事合入 main 的最新代码同步到本地，并保留当前 WIP 改动
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git branch --show-current)"
STASH_MSG="wip: sync with main $(date +%Y%m%d-%H%M)"

echo "==> 当前分支: ${BRANCH}"
echo "==> 暂存本地改动（含未跟踪文件）..."
git stash push -u -m "${STASH_MSG}"

echo "==> 拉取 origin/main ..."
git fetch origin
git checkout main
git pull --ff-only origin main

echo "==> 回到开发分支并变基到最新 main ..."
git checkout "${BRANCH}"
git rebase main

echo "==> 恢复本地改动 ..."
if git stash list | grep -q "${STASH_MSG}"; then
  git stash pop
else
  echo "（无匹配 stash，跳过 pop）"
fi

echo ""
echo "✅ 同步完成。如有冲突请手动解决后："
echo "   git add <files> && git rebase --continue   # 若在 rebase 中"
echo "   或解决 stash pop 冲突后 git add ..."
echo ""
echo "建议跑测试: npm test"
