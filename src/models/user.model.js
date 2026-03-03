import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String,
      required: true
    },
    isSystemAdmin: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

export default mongoose.model('User', userSchema)

// import mongoose from "mongoose";

// const userSchema = new mongoose.Schema({
//     name: {
//         type: String,
//         required: true,
//         },
//     email: {
//         type: String,
//         required: true,
//         unique: true,
//         },
//     password: {
//         type: String,
//         required: true,
//         },

//     role: {
//         type: String,
//         enum: ['admin', 'user'],
//         default: 'user'
//         }
// }, 

//     {timestamps: true,}

// );

// const User = mongoose.model("User", userSchema);
// export default User;
