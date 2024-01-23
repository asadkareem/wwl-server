import redisClient from "../config/redis.js";

export async function redisCache(req, res, next) {
    try {
        let key = ""
        if (req.originalUrl.includes('featured_recipes')) {
            key = "__express__featured" + req.originalUrl || req.url;
        } else if (req.originalUrl.includes('new_recipes')) {
            key = "__express__new" + req.originalUrl || req.url;
        } else {
            key = "__express__" + req.originalUrl || req.url;
        }


        const pageKey = "__express__" + req.params?.pageNum || req.url + req.params?.pageNum;

        const {pageNum} = req.params;
        let previousPage;


        if (!pageKey.includes('undefined')) {
            await redisClient.get(pageKey).then(reply => {
                previousPage = JSON.parse(reply);
            })
        }


        if (pageNum && previousPage &&  previousPage !== Number(pageNum) && !req.originalUrl.includes('featured_recipes')) {
            await redisClient.set(pageKey, pageNum);
            next();
        } else {
            await redisClient.get(key).then(reply => {
                if (reply) {
                    res.send(JSON.parse(reply));
                } else {
                    next();
                }
            })
        }
    } catch (err) {
        console.log(err)
    }
}