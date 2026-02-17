import mongoose from 'mongoose';
import Project from '../models/project.model.js';
import Client from '../models/client.model.js'; 
import { success, fail } from '../utils/response.js';


export const createProject = async (req, res) => {
    try {
        //Obtengo datos del body
        const {title, description, status, budget, startDate, endDate, client}= req.body

        //Verifico que el titulo y cliente sean proporcionados
        if(!title || !client){
            return fail(res, 400, "Titulo del proyecto y cliente son requeridos")}
        
        //Verifico que el ID del cliente sea válido
        if(!mongoose.Types.ObjectId.isValid(client)){
            return fail(res, 400, "ID de cliente no es válido")
        }

        //Verifico que el cliente exista y pertenezca al usuario autenticado
        const clientExists = await Client.findOne(
            {
                _id: client,
                owner: req.user.id
            }
        )
        
        //Si el cliente no existe, retorno un error
        if(!clientExists){
            return fail(res, 404, "Cliente no encontrado")
        }

        //Creo el proyecto
        const project = await Project.create({
            title,
            description,
            status,
            budget,
            startDate,
            endDate,
            client,
            owner: req.user.id
        })

        return success(res, 201, project)


    } catch (error) {
        return fail(res, 500, error.message)
    }
}


export const getProjects = async (req, res)=>{
    try {
        
        const projects = await Project.find({owner: req.user.id}).sort({createdAt: -1})

        return success(res, 200, projects)
    } catch (error) {
        return fail(res, 500, error.message)
    }


}