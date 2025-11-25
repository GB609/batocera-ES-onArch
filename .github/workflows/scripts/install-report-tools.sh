#!/bin/bash

#if [[ "$BRANCH_NAME" = release/* ]]; then
#  echo "Is relase branch - install lcov"
  if ! which genhtml; then
    sudo apt-get install lcov
  fi
#else
#  echo "Regular branch - do nothing"
#fi

mkdir -p tmp
(
  cd tmp
  git clone https://github.com/linux-test-project/lcov.git
  cd lcov
  git checkout tags/v2.3.2
  sudo make install
)
