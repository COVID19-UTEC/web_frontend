import { Component, OnInit, DoCheck, ViewChild, ElementRef, AfterViewInit, NgModule, enableProdMode } from '@angular/core';
import * as _moment from 'moment';
import { AbstractControl, Validators, FormBuilder } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { Title, BrowserModule } from '@angular/platform-browser';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import * as data from './data.json';
import MarkerClusterer from "@google/markerclusterer"
import { Overlay } from '@angular/cdk/overlay';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { DataService } from 'src/app/shared/services/data.service';
import { MapUser } from 'src/app/shared/models/mapUser.model';
import { Person } from 'src/app/shared/models/person.model';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { single } from './data';

import * as depData from './data/dep.json';
import * as provData from './data/prov.json';
import * as disData from './data/dist.json';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';

import { DxChartModule } from 'devextreme-angular';
import { ScatterData, Service } from './map.service';


const moment = _moment;

export const MY_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'YYYY',
  },
};

export class Coordenadas{
  latitud: number;
  longitud: number;

  constructor (lat, long){
    this.latitud = lat;
    this.longitud = long;
  }
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
  providers: [Service]
})
export class MapComponent implements AfterViewInit {

  constructor(
    private dateAdapter: DateAdapter<any>,
    private title: Title,
    private notificationService: NotificationService,
    private dataService: DataService,
    private fb: FormBuilder,
    service: Service
    ) { 
    this.title.setTitle("Dashboard");
    this.dateAdapter.setLocale('es');
    Object.assign(this, {single});
    this.regiones = (depData as any).default;
    this.provincia = (provData as any).default;
    this.distrito = (disData as any).default;
    this.dataSource = service.generateDataSource();
  }
  

  /* Gráficos */
  
  single: any[];
  multi: any[];

  dataSource: ScatterData[];

  view: any[] = [700, 400];

  //options (from template)
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = false;
  showXAxisLabel = true;
  xAxisLabel = 'Día';
  showYAxisLabel = true;
  yAxisLabel = 'Número de casos';
  colorScheme = {
    domain: ['#bf0909']
  };

  onSelect(event){
    console.log(event);
  }

  /*---------- */

  @ViewChild('mapContainer', {static: false}) gmap: ElementRef;

  selectedRegion = '';
  selectedProvincia = '';
  selectedDistrito = '';

/*Mapa */

// Data de regiones, provincias y distritos
  regiones:any; 
  provincia:any;
  distrito: any;
 

// Variables de control

map: google.maps.Map;
coordMapaInicial = new Coordenadas(-9.1899672, -75.015152);
coordinates = new google.maps.LatLng(this.coordMapaInicial.latitud, this.coordMapaInicial.longitud);

mapOptions: google.maps.MapOptions = {
  center: this.coordinates,
  zoom: 6,
  mapTypeId: 'hybrid', //Opciones de visualización
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: true,
  fullscreenControl: true
};

//Funcion de inicializacion 

  mapInitializer() {

    this.map = new google.maps.Map(this.gmap.nativeElement, this.mapOptions);

    let markers = this.distrito.map(
      function (dis, i){
        let pos = {"lat" : parseFloat(dis.latitud), "lng" : parseFloat(dis.longitud)};
        return new google.maps.Marker(
          {
            position: pos,
            icon : 
              {
                url : '/./../../../assets/pins/pingray1.svg',
                scaledSize: new google.maps.Size(0, 0),
                //size : new google.maps.Size (40,30)
              }
          }
        )
      }
    )

    new MarkerClusterer ( this.map, markers,
      {
        gridSize: 40,
        imagePath: '/./../../../assets/marketsicons/m'
      }
    );

    let drawingManager = new google.maps.drawing.DrawingManager (
      {
        drawingControl: true,
        drawingControlOptions: 
          {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [google.maps.drawing.OverlayType.RECTANGLE, google.maps.drawing.OverlayType.POLYGON, google.maps.drawing.OverlayType.CIRCLE ]
          }
      }
    );

    drawingManager.setMap(this.map);

    google.maps.event.addListener (drawingManager, 'rectanglecomplete', rectangle => this.figureComplete(rectangle,markers))

    google.maps.event.addListener (drawingManager, 'polygoncomplete', polygon => this.polygonComplete (polygon, markers))

    google.maps.event.addListener (drawingManager, 'circlecomplete', circle => this.figureComplete (circle, markers))
    
  }

  ngAfterViewInit() {
    this.mapInitializer();
  }

  /* Filtros */

  //Utilitarios

  getRegionId(name): string{
    return this.regiones.find(x => x.departamento == name).id;
  }

  getProvinciaId(name: any, dataFiltrada: any[]): any{
    let p = dataFiltrada.find(x => x.provincia == name);
    return [p.id, p.idp];
  }

  getLatLongFirstDistrict(type, id, idp?):any {
    let latLong: Array<any> = [];
    if (type == "dep"){
      let dist = this.distrito.filter(x => x.id == id)[0];
      latLong.push(dist.latitud, dist.longitud);
    }else if( type == "prov"){
      let dist = this.distrito.filter(x => x.id == id && x.idp == idp)[0];
      latLong.push(dist.latitud, dist.longitud);
    }
    return latLong;
  }

  provinciasFiltradas = [];
  distritosFiltrados = [];


  // Funciones

  selectRegion () {
    if (this.selectedRegion){
      this.provinciasFiltradas = [];
      let idRegionSelected: any;
      let latLong: any;
      for (let prov of this.provincia){
        idRegionSelected = this.getRegionId(this.selectedRegion);
        if (idRegionSelected == prov.id){
          latLong = this.getLatLongFirstDistrict("dep", idRegionSelected);
          prov['lat']=latLong[0];
          prov['lng']=latLong[1];
          this.provinciasFiltradas.push (prov);
        }
      }
      if (this.provinciasFiltradas.length){
        this.map.panTo ({"lat" : parseFloat(latLong[0]), "lng" : parseFloat(latLong[1])});
        this.map.setZoom(10);
      }
    }
  }

  deselectRegion (){
    this.selectedRegion = "";
    this.selectedProvincia = "";
    this.selectedDistrito = "";
    this.provinciasFiltradas = [];
    this.distritosFiltrados = [];
    this.map.panTo (this.coordinates);
    this.map.setZoom(6);
  }

  selectProvincia () {
    if (this.selectedProvincia){
      this.distritosFiltrados = [];
      let idProvSelected: any;
      let latLong: any;
      for (let dist of this.distrito){
        idProvSelected = this.getProvinciaId(this.selectedProvincia,this.provinciasFiltradas);
        if (idProvSelected[0] == dist.id && idProvSelected[1] == dist.idp){
          latLong = this.getLatLongFirstDistrict("prov",idProvSelected[0], idProvSelected[1]);
          dist['lat'] = latLong[0];
          dist['lng'] = latLong[1];
          this.distritosFiltrados.push (dist);
        }
      }
      if (this.distritosFiltrados.length){
        this.map.panTo ({"lat" : parseFloat(latLong[0]), "lng" : parseFloat (latLong[1])});
        this.map.setZoom (12);
      }
    }
  }

  deselectProvincia () {
    this.selectedProvincia = "";
    this.selectedDistrito = "";
    this.distritosFiltrados = [];
    this.map.panTo ({"lat" : parseFloat(this.provinciasFiltradas[0].latitud), "lng" : parseFloat(this.provinciasFiltradas[0].longitud)});
    this.map.setZoom (10);
  }

  selectDistrito () {
    if (this.selectedDistrito){
      for (let d of this.distritosFiltrados){
        if (this.selectedDistrito == d.distrito){
          this.map.panTo ({"lat" : parseFloat(d.latitud), "lng" : parseFloat (d.longitud)});
          this.map.setZoom (15);
          break;
        }
      }
    }
  }

  deselectDistrito () {
    this.selectedDistrito = "";
    this.map.panTo ({"lat" : parseFloat(this.distritosFiltrados[0].latitud), "lng" : parseFloat (this.distritosFiltrados[0].longitud)});
    this.map.setZoom (12);
  }
  /*Draw selection */

  SelectedMarkers = [];

  figureComplete (figure, markers) {
    console.log ("Figura creada");
    let temp = []
    markers.forEach (function (mark){
      if (figure.getBounds ().contains (mark.getPosition ())){
        console.log (mark.getPosition().toJSON());
        temp.push (JSON.stringify(mark.getPosition().toJSON()));
      }
    })
    this.SelectedMarkers.push(temp);
    figure.setVisible (false);
  }

  polygonComplete (figure, markers) {
    console.log ("Figura creada");
    var temp = []
    var paths = figure.getPaths();
    var bounds = new google.maps.LatLngBounds();
    paths.forEach(function(path) {
      var ar = path.getArray();
      for(var i = 0, l = ar.length;i < l; i++) {
        bounds.extend(ar[i]);
      }
    });
    markers.forEach (function (mark){
      if (bounds.contains (mark.getPosition ())){
        console.log (mark.getPosition().toJSON());
        temp.push (JSON.stringify(mark.getPosition().toJSON()));
      }
    })
    this.SelectedMarkers.push(temp);
    figure.setVisible (false);
  }

  check(){
    this.getData()
  }

  /* Selection */

  minDate = new Date("2020-03-06");
  maxDate = new Date();

  filtroForm = this.fb.group({
    fechaInicio: [this.minDate, Validators.required],
    fechaFin: [new Date(), Validators.required],
    estado: ['confirmed']
  })

  getData(){

    let req = new MapUser();
    req.from = Number (new Date(this.filtroForm.value.fechaInicio));
    req.to = Number (new Date(this.filtroForm.value.fechaFin));
    //req.from = this.filtroForm.value.fechaInicio;
    //req.to = this.filtroForm.value.fechaFin;
    req.state = this.filtroForm.value.estado;
    
    console.log(req);
    this.dataService.getData(req)
    .subscribe(puntos => console.log(puntos))
  }

  onNotify(){
    console.log(this.SelectedMarkers)
  }


  reportCaseForm = this.fb.group({
    document: [null, Validators.required],
    type: [null, Validators.required],
    report: [null, Validators.required]
  })

  docTypes: string[] = ['DNI', 'Pasaporte', 'Carnet de Extranjería'];
  reportType: string[] = ['Caso confirmado', 'Caso recuperado'];

  onReportCase () {
    let person = this.reportCaseForm.value;
    let req = new Person();
    req.document = person.document;
    req.type = person.type;
    if (person.report === "Caso confirmado"){
      this.notificationService.notifyConfirmedCase(req)
      .subscribe(res=> {this.resetReportCaseForm()})
    }else if(person.report === "Caso recuperado"){
      this.notificationService.notifyRecoverCase(req)
      .subscribe(res=> {this.resetReportCaseForm()})
    }

  }

  resetReportCaseForm () {
    this.reportCaseForm.reset();
  }

  notificationForm = this.fb.group({
    message: [null, Validators.required]
  })

  /*Devxtreme */

  onPointClick(e) {
    e.target.select();
}



  customizePoint = (arg: any) => {
      var color, hoverStyle;
      switch (arg.data.type) {
          case "Star":
              color = "red";
              hoverStyle = { border: { color: "red" } };
              break;
          case "Satellite":
              color = "gray";
              hoverStyle = { border: { color: "gray" } };
      }
      return { color, hoverStyle };
  }
}

export class DateValidator {
  static dateVaidator(AC: AbstractControl) {
    if (AC && AC.value && !moment(AC.value, 'DD/MM/AAAA', true).isValid()) {
      return { 'dateVaidator': true };
    }
    return null;
  }
}

