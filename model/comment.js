const mongoose = require("mongoose")
const Product = require("./product");

const Comment = mongoose.model('Comment',{
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: Product,
        required: true,
      },
      commentText: {
        type: String,
        required: true,
      },
})

module.exports = Comment;