#!/bin/bash

# Converts jsdoc-style *.js scripts coming from stdin to shdoc compatible output

shopt -s extglob

debug() {
  [ -z "$DEBUG_JSDOC" ] && return
  
	if [ "$1" = "-n" ]; then
		shift
		echo "$@" >&2
	else
		echo -n "$@" >&2
	fi
}

flush() {
	[ 0 -lt "${#BUFFER[@]}" ] && printf "%s\n" "${BUFFER[@]}"
}

reset() {
	[ LOOK_AHEAD = $MODE ] && MODE=$PREVIOUS_MODE
	HAS_DESC=false
	BUFFER=()
}

declare -A JS_DOC_ONLY
JS_DOC_ONLY["@returns"]=true

PRINT=() #action stack
MODE="IGNORE"
BUFFER=()
HAS_DESC=false
BLOCK_PREFIX=""
BRACE_LEVEL=""

handleQueuedActions() {
	debug "[${PRINT[@]}](nextMode=$MODE): "
	for output in "${PRINT[@]}"; do
		case $output in
			NL) debug -n ;;
			DEBUG) debug "[$source]" ;;
			CONV) line="# ${line##*( )'*'?( )}" ;;
			BUFFER) BUFFER+=("$line") ;;
			FLUSH) flush ;;
			CLEAR) BUFFER=() ;;
			OUT) echo "$line" ;;
			DESCRIPTION) [ $HAS_DESC = false ] && BUFFER=('# @description' "${BUFFER[@]}") ;;
			RESET) reset ;;
      REDO) processLine ;;
			*) echo "$output" ;;
		esac
	done
  PRINT=()
}

processLine() {
  # NL, DEBUG, CONV, BUFFER, FLUSH, CLEAR, OUT, DESCRIPTION, RESET, REDO, string
  PRINT=(DEBUG NL)
	source="$line"
  case "$MODE:$line" in
		*:*( )'*'*( )'@description'*)
			debug "FLAG_DESC="
			PRINT+=(FLUSH CLEAR CONV BUFFER)
			HAS_DESC=true
			;;
		BLOCK:*( )'*/'*( ))
			debug "BLOCK_END="
			PRINT+=(DESCRIPTION BUFFER FLUSH RESET)
			MODE=IGNORE
			;;
    *:*( )'/**'+(*)) # one-liner jsdoc, OR ill-formatted with text on the first line
      debug "MIXED_START="
      handleQueuedAction
      subText="${line##*( )'/**'}"
      prefix="${line%%subText}"
      line="$prefix"
      processLine
      line="${subText%'*/'}"
      PRINT+=(REDO)
      ;;
    COMMENT:*( )!('*')*)
      debug "NO_ML_JSDOC="
      MODE=LOOK_AHEAD
      PRINT+=(REDO)
      ;;
		COMMENT:*( )'*/'*)
			debug "LOOK_NEXT="
			PREVIOUS_MODE=${PREVIOUS_MODE:-COMMENT}
			MODE=LOOK_AHEAD
			;;
		COMMENT:*( )'*'*( )'@'@(file|section)*)
			debug "BLOCK_START="
			MODE=BLOCK
			PRINT+=(CONV OUT)
			;;
		LOOK_AHEAD:*( )'class '*)
			debug "CLASS_START="
			PRINT+=(DESCRIPTION FLUSH RESET OUT)
			className="${line##*( )class }"
			className="${className%%@( |{)*}"
			BLOCK_PREFIX="$className."
			BRACE_LEVEL="${line%%class*}"
			line="# @section class ${className}"$'\n'
			MODE=CLASS
			;;
		LOOK_AHEAD:*( )function*) ;&
		LOOK_AHEAD:*( )?(static)*( )*'('*')'*( ){*)
			debug "FUNCTION_DECL="
			PRINT+=(DESCRIPTION)
			fName="${line##*( )}"
			fName="${fName%%(*}"
			if [[ "$fName" =~ static* ]]; then
				fName="${fName##static*( )}"
				PRINT+=('# [static method]')
			fi
			PRINT+=(FLUSH RESET OUT)
			line="$BLOCK_PREFIX$fName() {"$'\n'
			;;
    LOOK_AHEAD:*) #anything unexpected will break the current COMMENT/BLOCK/CLASS
      debug "UNEXP_NEXT="
      PRINT+=(RESET)
      ;;
		CLASS:*( )'/**')
			debug "MEMBER_START="
			PREVIOUS_MODE=CLASS
			MODE=COMMENT
			;;
		CLASS:$BRACE_LEVEL})
	  	debug "CLASS_END="
	  	line="# @endsection"$'\n'
	  	PRINT+=(FLUSH RESET OUT)
	  	unset BLOCK_PREFIX PREVIOUS_MODE
			MODE=IGNORE
			;;
		BLOCK:*( )'*'*( )'@'*) ;&
		COMMENT:*( )'*'*( )'@'*)
			anno="${line##*( )'*'*( )'@'}"
			anno="${anno%% *}"
			if [ "${JS_DOC_ONLY['@'$anno]}" = true ]; then
				debug "MAP_ANNO="
				line="${line/'@'$anno/- $anno:}"
				PRINT+=(CONV BUFFER)			
			fi
			;;
		BLOCK:*) ;&
		COMMENT:*)
			debug "TAKE="
			PRINT+=(CONV BUFFER)
			;;
		IGNORE:*( )'/**')
			debug "START="
			MODE=COMMENT
			;;
		*)
			debug "IGNORE="
			;;
	esac
  handleQueuedActions
}

while IFS=$'\r'$'\n' read -r line; do
	#line="${line%$'\n'}"
	processLine
done

if [ 0 -lt "${#BUFFER[@]}" ]; then
	debug -n "BUFFER NOT EMPTY - flush rest"
	flush
fi
