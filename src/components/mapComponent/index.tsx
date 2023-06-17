import React, { useEffect, useRef } from 'react'
import { Viewer, } from "cesium";


import './style.css'
import { DrawingTool } from '../../helpers/DarwingTool';
export const MapComponent = () => {
    const drawingTool = useRef<DrawingTool>(null)
    useEffect(() => {
        const viewer = new Viewer("cesium_container", {
            animation: false,
            timeline: false,
            fullscreenButton: false,
            infoBox: false,
            homeButton: false,
            sceneModePicker: false,
            geocoder: false,
            baseLayerPicker: false,
            navigationHelpButton: false,
            selectionIndicator: false
        });
        //@ts-ignore
        drawingTool.current = new DrawingTool(viewer)

    }, [])
    const enableAddPolygon = ()=>{
        drawingTool.current?.enableAddPolygon()
    }
    const enableSelect = ()=>{
        drawingTool.current?.enableSelect()
    }
    const deleteSelect = ()=>{
        drawingTool.current?.deleteSelect()
    }
    const changeColor = ()=>{
        drawingTool.current?.changeColor()
    }
    return (
        <div id="cesium_container">
            <div className='tools-container'>
                <div onClick={enableAddPolygon}>add Polygon</div>
                <div onClick={enableSelect}>select</div>
                <div onClick={deleteSelect}>delete</div>
                <div onClick={changeColor}>ChangeColor</div>
            </div>
        </div>
    )
}
