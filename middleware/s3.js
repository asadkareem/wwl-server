import AWS from 'aws-sdk';

const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_ACCESS_SECRET
});

export const uploadImage = (file, bucket) => {
    const {name, data, mimetype: type} = file;

    const fileName = name?.replace(/ |\./g, '_');

    const config = {
        Bucket: bucket,
        Key: fileName,
        Body: data,
        ContentType: type,
        ACL: 'public-read',
    }

    return new Promise((resolve, reject) => {
        s3.putObject(config, (err, data) => {

            if (err) {
                return reject(err);
            }

            return resolve(`https://${bucket}.s3-us-west-2.amazonaws.com/${fileName}`);
        });
    });

}

export const deleteImage = (fileName, bucket) => {

    const config = {
        Bucket: bucket,
        Key: fileName
    }

    return new Promise((resolve, reject) => {
        s3.deleteObject(config, (err, data) => {

            if (err) {
                return reject(err);
            }

            return resolve('Success');
        });
    });

}
