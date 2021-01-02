const log4js = require("log4js");
const logger = log4js.getLogger("IntruderAlert");

const logFileLoc = '/home/pi/IntruderAlert/pi.txt';
const uploadFileLoc = "/home/pi/IntruderAlert/Videos";
const notificationUrl = 'https://us-central1-iot-intruder-alert.cloudfunctions.net/helloWorld';
const pythonFileLoc = '/home/pi/MotionDetection/index.py';

log4js.configure({
  appenders: {
    IntruderAlert: { type: 'file', filename: logFileLoc, maxLogSize: 1 * 1024 * 1024, backups: 3, compress: false }
  },
  categories: {
    default: { appenders: ['IntruderAlert'], level: 'info' }
  }
});


try {
  const { Storage } = require('@google-cloud/storage');
  const fs = require('fs');
  const request = require('request');
  const bucketName = "gs://iot-intruder-alert.appspot.com";
  const { PythonShell } = require('python-shell');
  const moment = require('moment')
  const { email } = require('./emailClient');
  const retentionDays = 1;
  const mailReceiver = 'govekarreshmi@gmail.com';
  const mailSubject = "Camera Attachment";
  const mailBody = 'The mail contains an attachment.';

  let files = [];
  let i = 0, j = 0;
  let flag = true;

  const storage = new Storage({
    projectId: "iot-intruder-alert",
    keyFilename: "/home/pi/IntruderAlert/iot-intruder-alert.json"
  });

  const runPiCamera = () => {
    try {
      logger.info("Starting camera")
      PythonShell.run(pythonFileLoc, null, function (err) {
        if (err) {
          logger.error(err)
          uploadLog();
        }
        logger.info('finished');
      });
    } catch (error) {
      logger.error(error)
      uploadLog();
    }
  }

  const func = () => {
    try {
      if (flag) {
        checkIfMidnight();
      }
      if (files.length === 0) {
        ThroughDirectory(uploadFileLoc);
        logger.debug(files)
      }
      if (files.length > 0) {
        for (let index = files.length-1; index >= 0; index--) {
          uploadFile(files[index]).then(() => {
            logger.info("Uploading file " + files[index] + " to cloud")
            logger.info("Sending email attachment");
            email.sendEmail(mailReceiver, mailSubject, mailBody, [{ path: files[index] }]).then(info => {
              logger.info('Email sent: ' + info.response);
              logger.info("Sending notification")
              request(notificationUrl, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  logger.info(body) // Print the web page.
                  fs.unlink(files[index], () => {
                    logger.info('Deleted file' + files[index])
                    files.splice(index, 1)
                    setTimeout(() => {
                      func();
                    }, 60000 * 5)
                  })
                }
              })
            })
          })
        }
      }
    } catch (error) {
      logger.error(error.message);
          uploadLog().then(() => {
            func();
          });
    }
  }

  const uploadFile = (filename) => {
    return storage.bucket(bucketName).upload(filename, {
      gzip: true,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    }).then(() => {
      logger.info(`${filename} uploaded to ${bucketName}.`);
    })
  }

  const uploadLog = () => {
    logger.warn("Uploading logs")
    return email.sendEmail(mailReceiver, mailSubject, mailBody, [{ path: logFileLoc }]).then(info => {
      logger.warn("Exception occured. Log uploaded")
    })
  }

  const ThroughDirectory = (Directory) => {
    fs.readdirSync(Directory).forEach(File => {
      const Absolute = Directory + '/' + File;
      if (fs.statSync(Absolute).isDirectory()) return ThroughDirectory(Absolute);
      else return files.push(Absolute);
    });
  }

  async function deleteFile(filename) {
    // Deletes the file from the bucket
    await storage.bucket(bucketName).file(filename).delete();

    logger.info(`gs://${bucketName}/${filename} deleted.`);
  }

  async function listFiles() {
    // Lists files in the bucket
    logger.info("Listing files")
    const [files] = await storage.bucket(bucketName).getFiles();
    return files;
  }

  const processFiles = (files) => {
    logger.info("Processing files for deletion");
    const tobeDeleted = [];
    files.forEach(file => {
      const virtDate = moment().add(-(retentionDays), 'days').toArray();
      const fileDate = moment(file.metadata.timeCreated, 'YYYY-MM-DDTHH:mm:ss:fffZ').toArray();
      var flag = false;

      for (let index = 0; index < 3; index++) {
        if (virtDate[index] > fileDate[index]) {
          flag = true;
          break;
        }
      }
      if (flag) {
        tobeDeleted.push(file.metadata.name)
      }
    });
    return tobeDeleted;
  }

  const checkIfMidnight = () => {
    try {
      logger.info("Checking if Midnight for purging the storage");
    const date = moment().toArray()

    if (date[3] == 0 && flag) {
      flag = false;
      deletionJob();

      setTimeout(() => {
        flag = true;
        checkIfMidnight();
      }, 60000 * 60 * 24)
    }
    } catch (error) {
      logger.error(error)
    }
  }

  const deletionJob = () => {
    listFiles().then(files => {
      logger.debug(files)
      processFiles(files).forEach(filename => {
        deleteFile(filename)
          .catch(error => {
            logger.error(error)
          });
      })
    }).catch(error => {
      logger.error(error)
    })
  }

  runPiCamera();
  setTimeout(() => {
    func();
  }, 60000 * 6)

}
catch (e) {
  logger.error(e);
}
