import {uploadImage, deleteImage} from "../middleware/s3.js";
import asyncHandler from "express-async-handler";

const uploadImageFromS3 = asyncHandler(async (req, res, next) => {
    try {
        const file = req.files.file;
        const s3Url = await uploadImage(file, req.params.bucket);
        res.status(200).send(s3Url);
    } catch (e) {
        next(e);
    }
});

const deleteImageFromS3 = asyncHandler(async (req, res, next) => {
    try {
        const response = await deleteImage(req.params.fileName, req.params.bucket);
        res.status(200).send(response);
    } catch (e) {
        next(e);
    }
});

export {
    uploadImageFromS3,
    deleteImageFromS3
}
