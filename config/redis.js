import {createClient} from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});



redisClient.on('ready', () => {
    console.log("Redis Connected Successfully!");
    // redisClient.flushAll()
});

redisClient.on('error', (err) => {
    console.log("Error " + err);
})


export default redisClient;