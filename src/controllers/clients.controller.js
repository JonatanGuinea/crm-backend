import mongoose from 'mongoose';
import Client from '../models/client.model.js';
import { success, fail } from '../utils/response.js';

// Crear cliente
export const createClient = async (req, res) => {
  try {
    const { name, email, phone, company, notes } = req.body

    if (!name)
      return fail(res, 400, "El nombre es obligatorio")

    if (!req.user.organizationId)
      return fail(res, 400, "Organización activa requerida")

    const client = await Client.create({
      name,
      email,
      phone,
      company,
      notes,
      organization: req.user.organizationId,
      createdBy: req.user.id
    })

    return success(res, 201, client)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Obtener todos
export const getClients = async (req, res) => {
  try {
    const clients = await Client.find({
      organization: req.user.organizationId
    }).lean()

    return success(res, 200, clients)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Obtener por ID
export const getClientById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id))
      return fail(res, 400, "ID inválido")

    const client = await Client.findOne({
      _id: id,
      organization: req.user.organizationId
    }).lean()

    if (!client)
      return fail(res, 404, "Cliente no encontrado")

    return success(res, 200, client)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Actualizar
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id))
      return fail(res, 400, "ID inválido")

    delete req.body.organization

    const allowedFields = ["name", "email", "phone", "company", "notes"]

    const updates = {}

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    const updatedClient = await Client.findOneAndUpdate(
      {
        _id: id,
        organization: req.user.organizationId
      },
      updates,
      { new: true, runValidators: true }
    ).lean()

    if (!updatedClient)
      return fail(res, 404, "Cliente no encontrado")

    return success(res, 200, updatedClient)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Eliminar
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id))
      return fail(res, 400, "ID inválido")

    const deletedClient = await Client.findOneAndDelete({
      _id: id,
      organization: req.user.organizationId
    })

    if (!deletedClient)
      return fail(res, 404, "Cliente no encontrado")

    return success(res, 200, "Cliente eliminado correctamente")

  } catch (error) {
    return fail(res, 500, error.message)
  }
}