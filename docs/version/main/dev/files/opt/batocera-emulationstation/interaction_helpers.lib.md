# /opt/batocera-emulationstation/interaction_helpers.lib

## Overview

simple helper that can be used to determine if a graphical dialog shall be shown


## Index

* [_listChoice](#_listchoice)
* [_ask](#_ask)
* [_interface:errorAbort](#_interfaceerrorabort)

## _listChoice

To be used by _askChoice. Encapsulates decision how and where to write the choices.
For now, only tty is supported.
$1 index
$2 text

## _ask

Get a single line from the user and keep as it is.
$1: question to ask
$2: default value

## _interface:errorAbort

Print and log a message, exit shell


<sub>Generated with shdoc from [/opt/batocera-emulationstation/interaction_helpers.lib](https://github.com/GB609/batocera-ES-onArch/blob/2fcdc6d5cce3a8de9711781c90aee9a9d66303c9
/sources/fs-root/opt/batocera-emulationstation/interaction_helpers.lib)</sub>