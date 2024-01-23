import mongoose from 'mongoose';

export const TagSchema = mongoose.Schema({
  tag: String,
  type: String
});

const Tag = mongoose.model('Tag', TagSchema);
export default Tag;