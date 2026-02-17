import User from '../models/user.model.js'
import { hashPassword, comparePassword } from '../utils/passwordHash.js'
import { generateToken } from '../utils/jwt.js'
import {success, fail} from '../utils/response.js'

//REGISTRO

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body

    if(!name || !email || !password) {
        // return res.status(400).json({ message: 'Faltan datos' })
        return fail(res,400,'Faltan datos')
    }
    const exist = await User.findOne({email})

    if(exist){
        // return res.status(400).json({message:'El usuario ya existe'})
        return fail(res,400,'El usuario ya existe')
    }

    const hashedPassword= await hashPassword(password)

    const user = await User.create({
        name,
        email,
        password:hashedPassword
    })

    return success(res,201, user)
    

}catch (error){
        return fail(res, 500, error.message)
    }
}



//LOGIN
export const login = async(req, res)=>{
    try {
        
        const {email, password} = req.body;

        const user = await User.findOne({email})

        if(!user){
            return fail(res,401,'Email o password inválidos')
        }

        const isValid= await comparePassword(password, user.password)

        if(!isValid){
            return fail(res,400,'Email o password inválidos')
        }


        const token = generateToken(user)

        res.json({
            message:'Login correcto',
            token
        })

    } catch (error) {
        return fail(res, 500, error.message)
    }
}

