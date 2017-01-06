// require modules
const fs = require('fs');
const archiver = require('archiver');

const log = function () {}

// write a zip file to disk that contains multiple text files
// @param[in] filePath The zip file path on disk
// @param[in] zipContent An object that contains file names and data in the
// archive (ex: {'toto.txt': 'toto file content', 'file2.txt': 'lorem ipsum'}
// @param[in] cb The callback function with the following params: (err)
exports.compressTextFilesToZip = function(filePath, zipContent, cb)
{

  // create a file to stream archive data to.
  var output = fs.createWriteStream( filePath ) //__dirname + '/example.zip');
  var archive = archiver('zip', {
    store: true // Sets the compression method to STORE.
  })

  // listen for all archive data to be written
  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes')
    log(filePath + ' created')
    cb (null)
  })

  // good practice to catch this error explicitly
  archive.on('error', function(err) {
    cb(err)
  })

  // pipe archive data to the file
  archive.pipe(output);
  for (fname in zipContent) {
    const data = zipContent[fname]
    // append a file from string
    archive.append(data, { name: fname })
  }
  // finalize the archive. We are done appending files but streams have
  // yet to finish
  archive.finalize()
}



