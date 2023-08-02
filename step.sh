#!/bin/bash
set -ex

account_id=${account_id:=""}
app_id=${app_id:=""}
track_name=${track_name:=""}
user_email=${user_email:=""}
password=${password:=""}
ignore_warn=${ignore_warn:=""}
screenshot_review=${screenshot_review:=""}
screenshot_size=${screenshot_size:=""}
totp_secret=${totp_secret:=""}
timeout=${timeout:="30000"}
dry_run=${dry_run:=""}

SOURCE_DIR=$(pwd)
STEP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd $STEP_DIR

npm install

IGNORE_WARN_OPTION=""
if [ "${ignore_warn}" = "yes" ]; then
  IGNORE_WARN_OPTION="-w"
fi

DRY_RUN_OPTION=""
if [ "${dry_run}" = "yes" ]; then
  DRY_RUN_OPTION="-D"
fi

SCREENSHOT_REVIEW=""
if [ "${screenshot_review}" = "yes" ]; then
  SCREENSHOT_REVIEW="-s"
fi

SCREENSHOT_DIR="/tmp/google_play_rollout"
if [ ! -d "$SCREENSHOT_DIR" ]; then
  mkdir "$SCREENSHOT_DIR"
fi

retry() {
    MAX_RETRY_COUNT=3
    INTERVAL=5
    i=0
    while true; do
      set +e
      "$@"
      if [ $? -eq 0 ]; then
          break
      fi
      set -e

      i=$((i + 1))
      if [ $i -eq $MAX_RETRY_COUNT ]; then
          echo "Error: command failed after $max_retry_count attempts"
          exit 1
      fi

      sleep $INTERVAL
    done
}

COMMAND=$(cat<<EOF
node ./src/main.js \
    -i "${account_id}" \
    -a "${app_id}" \
    -t "${track_name}" \
    -e "${user_email}" \
    -p "${password}" \
    ${IGNORE_WARN_OPTION} \
    ${DRY_RUN_OPTION} \
    ${SCREENSHOT_REVIEW} \
    -d "${SCREENSHOT_DIR}" \
    -c "${screenshot_size}" \
    -S "${totp_secret}" \
    -T "${timeout}"
EOF)

if [ "$(uname)" = "Linux" ]; then
    retry xvfb-run --auto-servernum $COMMAND
else
    retry $COMMAND
fi

envman add --key GOOGLE_PLAY_SCREENSHOT_PATH --value "$(cat /tmp/export_GOOGLE_PLAY_SCREENSHOT_PATH)"
envman add --key GOOGLE_PLAY_WARNING_TEXT --value "$(cat /tmp/export_GOOGLE_PLAY_WARNING_TEXT)"

cd "$SOURCE_DIR"
