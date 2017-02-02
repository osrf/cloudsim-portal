// require modules
const fs = require('fs')
const child_process = require('child_process')

// using zip (which must be installed on machine), this function creates a zipFile
// that contains an ssh key (with 600 permisssions)
// @param[in] zipFileName The short file name of the zip archive. This file
// will be created in the /tmp directory
// @param[in] keyFileName The name of the ssh key file inside the zip archive.
// @param[in] keyData The ssh key information (will be saved in /tmp)
// @param[in] cb Callback function with the following params: err (error).
exports.zipSshKey = function(zipFileName, keyFileName, keyData, cb)
{
  // save file in /tmp
  const fpath = "/tmp/" + keyFileName

  fs.writeFile( fpath, keyData, (err)=> {
    if(err) {
      return cb(err)
    }
    console.log(fpath + ' written')
    const cmd = 'cd /tmp && chmod 600 ' + keyFileName + '  && zip ' + zipFileName + ' ' + keyFileName
    console.log(cmd)
    child_process.exec(cmd, (err) => {
      if(err) {
        return cb(err)
      }
      cb()
    })
  })
}
