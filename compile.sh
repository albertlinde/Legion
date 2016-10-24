echo "Creating legion-min.js"
node compile.js > applications/legion-min.js
echo "Creating drive-ext-min.js"
node compile_drive.js > applications/drive-ext-min.js
echo "Done compiling min.js files."