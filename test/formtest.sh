source $SH_LIB_DIR/generic-utils.shl
source $SH_LIB_DIR/user-interface.shl < /dev/null

declare -A FORM
use_var=FORM ui:form 'install details' <<EOF
pick=ui askChoice "Blubb" --choices A B::P C D E
q=ui ask 'Please \$give me [something] nice!' Candies
EOF

declare -p FORM