import mongoose from 'mongoose'

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    })

    console.log(`Database Connected: ${conn.connection.host}`)
  } catch (error) {
    console.error(`Error: ${error.message}`)
  }
}

export default connectDB