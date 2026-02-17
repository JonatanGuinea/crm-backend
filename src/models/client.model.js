import mongoose from 'mongoose';


const clientSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    email:{
        type: String,
    },
    phone:{
        type: String,
    },
    company:{
        type: String,
    },
    notes:{
        type: String,
    },
    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
},{
    timestamps: true
})


const Client = mongoose.model('Client', clientSchema);
export default Client;