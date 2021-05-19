const functions = require('firebase-functions');
const admin = require("firebase-admin");
const { Storage } = require('@google-cloud/storage');
const moment = require("moment")
const bucketName = "gs://iot-intruder-alert.appspot.com";
const topicName = 'intruderAlert'
const retentionDays = 7;

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const storage = new Storage();

const message = {
  notification: {
    title: 'Image uploaded. Please check it out!'
  },
  android: {
    notification: {
      image: 'https://foo.bar.pizza-monster.png'
    }
  },
  apns: {
    payload: {
      aps: {
        'mutable-content': 1
      }
    },
    fcm_options: {
      image: 'https://foo.bar.pizza-monster.png'
    }
  },
  webpush: {
    headers: {
      image: 'https://foo.bar.pizza-monster.png'
    }
  },
  topic: topicName,
};

async function deleteFile(filename) {
  // Deletes the file from the bucket
  await storage.bucket(bucketName).file(filename).delete();

  console.log(`gs://${bucketName}/${filename} deleted.`);
}

async function listFiles() {
  // Lists files in the bucket
  const [files] = await storage.bucket(bucketName).getFiles();
  return files;
}

const processFiles = (files) => {
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

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
  admin.messaging().send(message)
    .then((response) => {
      // Response is a message ID string.
      console.log('Successfully sent message:', response);
      listFiles().then(files => {
        processFiles(files).forEach(filename => {
          deleteFile(filename)
            .catch(error => {
              console.error(error)
            });
        })
      }).catch(error => {
        console.error(error)
      })
    })
    .catch(error => {
      console.log('Error sending message:', error);
    });
  response.send("Please check your phone for notification!");
});