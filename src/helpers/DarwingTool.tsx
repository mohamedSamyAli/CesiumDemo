import {
    CallbackProperty, Cartesian2,
    Cartesian3, Cartographic, Color, Entity,
    SceneTransforms, ScreenSpaceEventHandler, ScreenSpaceEventType,
    Viewer
} from "cesium";
import { bearing, point, polygon, transformRotate } from '@turf/turf'
export class DrawingTool {
    viewer: Viewer
    shapePoints: Array<Cartesian3>
    isDrawingActive: boolean
    currentDrawingShape: Entity | null;
    shapePointsLength: number
    eventHandler: ScreenSpaceEventHandler
    mode: 'select' | 'draw'
    selectionBoundry: Entity | null
    selectionBoundryPoints: Array<Entity>
    isDraging: boolean
    startDragingPostion: Cartesian3 | null
    selectedCenter: Array<number>
    selectedEntitiy: Entity | null
    selectedLatLngInitPostions: Array<Array<number>>
    selectedPostions: { positions: Array<Cartesian3> }
    constructor(_viewer: Viewer) {
        this.viewer = _viewer
        this.shapePoints = []
        this.isDrawingActive = false
        this.currentDrawingShape = null
        this.shapePointsLength = 0
        this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas)
        this.mode = "draw"
        this.selectionBoundry = null
        this.selectionBoundryPoints = []
        this.isDraging = false
        this.startDragingPostion = null
        this.selectedCenter = [0, 0]
        this.selectedLatLngInitPostions = []
        this.selectedEntitiy = null
        this.selectedPostions = { positions: [] }
        this.addListeners()
    }
    removeAllBoundryPoints() {
        this.selectionBoundryPoints.forEach(ele => {
            this.viewer.entities.remove(ele)
        })
        this.selectionBoundryPoints = []
    }
    removeSelectionBoundry() {
        this.removeAllBoundryPoints()
        if (this.selectionBoundry)
            this.viewer.entities.remove(this.selectionBoundry)

        this.selectionBoundry = null

    }
    addListeners() {
        this.viewer.cesiumWidget.container.classList.toggle("cursor-crosshair")
        //add left-click listener
        this.eventHandler.setInputAction((event: any) => {
            if (this.mode === 'draw') {
                this.isDrawingActive = true
                var newPosition = this.viewer.camera.pickEllipsoid(event.position);
                if (!this.currentDrawingShape) {
                    var dynamicPositions = new CallbackProperty((() => {
                        return { positions: this.shapePoints };
                    }), false);
                    this.currentDrawingShape = this.viewer.entities.add({
                        polygon: {
                            hierarchy: dynamicPositions,
                            height: 0,
                            material: Color.RED.withAlpha(0.5),
                            outline: true,
                            outlineWidth:4,
                            outlineColor: Color.BLACK,
                        },
                    });
                }
                this.shapePoints.push(newPosition as Cartesian3)
                this.shapePointsLength++
            } else if (this.mode === "select") {
                let picked = this.viewer.scene.pick(event.position)
                console.log("p->", picked)
                this.onSelectObject(picked?.id)
            }

        }, ScreenSpaceEventType.LEFT_CLICK)

        
        this.eventHandler.setInputAction((event: any) => {
            let entity: Entity = this.viewer.scene.pick(event.position)
            if (entity) {
                this.isDraging = true
                this.startDragingPostion = event.position
                this.viewer.scene.screenSpaceCameraController.enableRotate = false


            }
        }, ScreenSpaceEventType.LEFT_DOWN)
        this.eventHandler.setInputAction((event: any) => {
            this.isDraging = false
            this.viewer.scene.screenSpaceCameraController.enableRotate = true
        }, ScreenSpaceEventType.LEFT_UP)
        //add mouse-move listener 
        this.eventHandler.setInputAction((event: any) => {
            if (this.isDrawingActive) {
                var newPosition = this.viewer.camera.pickEllipsoid(event.endPosition);
                if (this.shapePointsLength < this.shapePoints.length)
                    this.shapePoints.pop()

                this.shapePoints.push(newPosition as Cartesian3)
            }
            if (this.isDraging && this.startDragingPostion && this.selectedEntitiy && this.selectedLatLngInitPostions.length) {
                //@ts-ignore
                let rotationAngle = this.getRotationAngel(this.selectedCenter,
                    this.viewer.camera.pickEllipsoid(this.startDragingPostion),
                    this.viewer.camera.pickEllipsoid(event.endPosition)
                )
                let rotatedPolygon = transformRotate(polygon([[...this.selectedLatLngInitPostions, this.selectedLatLngInitPostions[0]]]), rotationAngle, { pivot: this.selectedCenter })
                let Cart3Coordinate = rotatedPolygon.geometry.coordinates[0].map(ele => {
                    return Cartesian3.fromDegrees(ele[0], ele[1])
                })
                Cart3Coordinate.pop()

                if (this.selectedEntitiy)
                    this.selectedPostions.positions = Cart3Coordinate

            }
            // 

        }, ScreenSpaceEventType.MOUSE_MOVE)

        // add double-click listener
        this.eventHandler.setInputAction((event: any) => {
            if (this.isDrawingActive) {
                this.isDrawingActive = false
                let points = { positions: [...this.shapePoints] }
                let entity = this.viewer.entities.add({
                    polygon: {
                        hierarchy: new CallbackProperty(() => {
                            return { positions: points.positions }
                        }, false)
                        ,
                        height: 0,
                        material: Color.WHITE.withAlpha(0),
                        outlineWidth:9,
                        outline: true,
                        outlineColor: Color.BLACK,
                    },

                });
                //@ts-ignore
                entity.points = points
                if (this.currentDrawingShape) {
                    this.viewer.entities.remove(this.currentDrawingShape)
                }

                this.currentDrawingShape = null
                this.shapePoints = []
                this.shapePointsLength = 0
            }
  
        }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    }
    getcoordinatesForBoundingBox(points: Array<Cartesian3>) {
        let maxX = Number.MIN_VALUE
        let minX = Number.MAX_VALUE
        let maxY = Number.MIN_VALUE
        let minY = Number.MAX_VALUE
        points.forEach(_ele => {
            let ele = SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, _ele)
            if (ele.x > maxX) {
                maxX = ele.x
            }
            if (ele.x < minX) {
                minX = ele.x
            }
            if (ele.y > maxY) {
                maxY = ele.y
            }
            if (ele.y < minY) {
                minY = ele.y
            }
        })
        return [
            this.viewer.camera.pickEllipsoid(new Cartesian2(minX, minY)),
            this.viewer.camera.pickEllipsoid(new Cartesian2(minX, maxY)),
            this.viewer.camera.pickEllipsoid(new Cartesian2(maxX, maxY)),
            this.viewer.camera.pickEllipsoid(new Cartesian2(maxX, minY))
        ]
    }
    getLatLngArrayFromCartestian(postions: Array<Cartesian3>) {
        let result: Array<Array<number>> = []
        postions.forEach(ele => {
            let latLng = Cartographic.fromCartesian(ele)
            result.push([latLng.longitude * 180 / Math.PI, latLng.latitude * 180 / Math.PI])
        })
        return result
    }
    onSelectObject(selectedEntity: Entity) {
        this.removeSelectionBoundry()
        this.selectedEntitiy = null
        if (this.mode === 'select' && selectedEntity && selectedEntity.polygon) {
            this.selectedEntitiy = selectedEntity
            //@ts-ignore
            this.selectedPostions = selectedEntity.points

            this.selectionBoundry = this.viewer.entities.add({
                polygon: {
                    hierarchy: new CallbackProperty(() => {
                        //@ts-ignore
                        let positions = this.getcoordinatesForBoundingBox(selectedEntity.polygon?.hierarchy?.getValue().positions)
                        this.removeAllBoundryPoints()

                        positions.forEach((e, i) => {
                            this.selectionBoundryPoints[i] = this.viewer.entities.add({
                                position: e,
                                point: {
                                    pixelSize: 5,
                                    outlineWidth: 3,
                                    outlineColor: Color.BLUE,
                                },
                                properties: {
                                    type: "rotatePoint"
                                }
                            })
                        })
                        return { positions: positions }
                    }
                        , false),
                    height: 0,
                    material: Color.RED.withAlpha(0),
                    outline: true,
                    outlineWidth: 3,
                    outlineColor: Color.BLUE,
                },
            })
            //@ts-ignore
            this.selectedLatLngInitPostions = this.getLatLngArrayFromCartestian(this.selectedPostions.positions)

            this.selectedCenter = this.getCenterFrmLatLngArray(this.selectedLatLngInitPostions)

        }
    }
    getCenterFrmLatLngArray(positions: Array<Array<number>>) {
        let latSum = 0
        let lngSum = 0
        positions.forEach(ele => {
            lngSum += ele[0]
            latSum += ele[1]
        })
        return [lngSum / positions.length, latSum / positions.length]
    }
    getRotationAngel(center: [number, number], firstPoint: Cartesian3, secoundPoint: Cartesian3) {
        let firstPointLatLng = Cartographic.fromCartesian(firstPoint)
        let secoundPointLatLng = Cartographic.fromCartesian(secoundPoint)
        let bearing1 = bearing(point(center), point([firstPointLatLng.longitude * 180 / Math.PI, firstPointLatLng.latitude * 180 / Math.PI]))
        let bearing2 = bearing(point(center), point([secoundPointLatLng.longitude * 180 / Math.PI, secoundPointLatLng.latitude * 180 / Math.PI]))
        return bearing2 - bearing1
    }
    enableAddPolygon() {
        this.mode = "draw"
        this.removeSelectionBoundry()
        this.viewer.cesiumWidget.container.classList.add("cursor-crosshair")
        this.shapePoints = []
        this.currentDrawingShape = null
        this.shapePointsLength = 0
        this.startDragingPostion = null
        this.selectedCenter = [0, 0]
        this.selectedLatLngInitPostions = []
        this.selectedEntitiy = null
        this.selectedPostions = { positions: [] }
    }
    enableSelect() {
        this.mode = "select"
    }

    deleteSelect() {
        if (this.selectedEntitiy) {
            this.viewer.entities.remove(this.selectedEntitiy)
            this.removeSelectionBoundry()

        }
    }
    changeColor() {
        if (this.selectedEntitiy?.polygon?.outlineColor)
        //@ts-ignore
            this.selectedEntitiy.polygon.outlineColor = Color.GREEN
    }

}