#!/bin/bash

if [[ "$BRANCH_NAME" = release/* ]]; then
  echo "Is relase branch - install lcov"
  if ! which genhtml; then
    sudo apt-get install lcov
  fi
else
  echo "Regular branch - do nothing"
fi