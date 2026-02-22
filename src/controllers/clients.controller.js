import mongoose from 'mongoose';
import Client from '../models/client.model.js';
import {success, fail} from '../utils/response.js'


//CREAR CLIENTE

export const createClient = async (req, res) => {
  try {
    const { name, email, phone, company, notes } = req.body

    if (!name) return fail(res, 400, "El nombre es obligatorio")

    const client = await Client.create({
      name,
      email,
      phone,
      company,
      notes,
      owner: req.user._id
    })

    return success(res, 201, client)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}



//OBTENER CLIENTES

    //OBTENER TODOS LOS CLIENTES
export const getClients = async (req, res) => {
  try {
    const clients = await Client.find({ owner: req.user._id }).lean()
    return success(res, 200, clients)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}



    //OBTENER UN CLIENTE POR ID

export const getClientById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id))
      return fail(res, 400, "ID inválido")

    const client = await Client.findOne({
      _id: id,
      owner: req.user._id
    })

    if (!client)
      return fail(res, 404, "Cliente no encontrado")

    return success(res, 200, client)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}


export const updateClient = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id))
      return fail(res, 400, "ID inválido")

    const updatedClient = await Client.findOneAndUpdate(
      { _id: id, owner: req.user._id },
      req.body,
      { new: true, runValidators: true }
    )

    if (!updatedClient)
      return fail(res, 404, "Cliente no encontrado")

    return success(res, 200, updatedClient)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}



export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id))
      return fail(res, 400, "ID inválido")

    const deletedClient = await Client.findOneAndDelete({
      _id: id,
      owner: req.user._id
    })

    if (!deletedClient)
      return fail(res, 404, "Cliente no encontrado")

    return success(res, 200, "Cliente eliminado correctamente")

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
