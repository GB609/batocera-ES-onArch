CMD=bash -c 'echo -e "1:$TEST_VAR1 2:$TEST_VAR2\nDIR:$(pwd)" > .state; cat .state' 
ENV=TEST_VAR1=42 TEST_VAR2="blank something"
DIR=subdirectory