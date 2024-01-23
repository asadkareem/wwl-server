import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv'
import fileUpload from 'express-fileupload'

import {globalErrorHandler} from './controllers/errorController.js'
import AppError from './utilis/appError.js'
import ingredientRoutes from './routes/ingredientRoutes.js'
import mealplanRoutes from './routes/mealplanRoutes.js'
import ratingRoutes from './routes/ratingRoutes.js'
import recipecollectionRoutes from './routes/recipecollectionRoutes.js'
import recipeNoteRoutes from './routes/recipenoteRoutes.js'
import recipeRoutes from './routes/recipeRoutes.js'
import shoppinglistRoutes from './routes/shoppinglistRoutes.js'
import userRoutes from './routes/userRoutes.js'
import tagRoutes from './routes/tagRoutes.js'
import imageRouter from './routes/imageRouter.js'

import connectDB from './config/db.js'
import redisClient from "./config/redis.js";
import memberfulRouter from "./routes/memberfulRouter.js";


// ------------------------------
// Init Express App
// ------------------------------
dotenv.config();  // Load ENV
connectDB() // connect DB
redisClient.connect() // connect Redis
const app = express();
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({extended: true})); // For parsing application/x-www-form-urlencoded
app.use(cors());
app.use(fileUpload())

// ------------------------------
// routes
// ------------------------------

app.get('/', (req, res) => {
    redisClient.flushAll()
    res.send(`WWL Server v0.0.1 is Running...`);
});

app.use('/ingredients', ingredientRoutes)
app.use('/shoppingLists', shoppinglistRoutes)
app.use('/mealplans', mealplanRoutes)
app.use('/ratings', ratingRoutes)
app.use('/recipeCollections', recipecollectionRoutes)
app.use('/recipeNotes', recipeNoteRoutes)
app.use('/recipes', recipeRoutes)
app.use('/users', userRoutes)
app.use('/images', imageRouter)
app.use('/tags', tagRoutes)
app.use('/memberful', memberfulRouter)

// To deal all request whose URL is not specified in the server
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

// ------------------------------
// Listen at port 8080
// ------------------------------
const port = parseInt(process.env.PORT) || 8080;
app.listen(port, '0.0.0.0', () => {
    console.log(`WWL API listening on port ${port}`);
});