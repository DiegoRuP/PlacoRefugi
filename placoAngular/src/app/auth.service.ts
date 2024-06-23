import { Injectable, inject, signal } from '@angular/core';
import { Auth, PhoneAuthProvider, RecaptchaVerifier, UserCredential, createUserWithEmailAndPassword, signInWithCredential, signInWithEmailAndPassword, signInWithPhoneNumber, signOut, updateProfile, user } from '@angular/fire/auth';
import { Observable, from } from 'rxjs';
import { Firestore, doc, setDoc, collection, getDocs, QuerySnapshot, collectionData } from '@angular/fire/firestore';
import { UserInterface } from './user.interface';

@Injectable({
  providedIn: 'root'
})

export class AuthService {
  firebaseAuth = inject(Auth);
  firestore = inject(Firestore);
  user$ = user(this.firebaseAuth);
  currentUserSig = signal<UserInterface | null | undefined>(undefined);
  private recaptchaVerifier?:RecaptchaVerifier;
  private userCrenedtial?:UserCredential;

  //registrar usuario
  registrar(correo: string, usuario: string, contra: string, telefono: string): Observable<void> {
    const promise = createUserWithEmailAndPassword(this.firebaseAuth, correo, contra)
      .then(response => {
        return updateProfile(response.user, { displayName: usuario }).then(() => {
          //guardar los datos en firestore
          const userDocRef = doc(this.firestore, `users/${response.user.uid}`);
          return setDoc(userDocRef, {
            uid: response.user.uid,
            email: correo,
            displayName: usuario,
            telefono: telefono
          });
        });
      });
    return from(promise);
  }

  //login normal
  login(correo: string, contra: string): Observable<void>{
    const promise = signInWithEmailAndPassword(this.firebaseAuth, correo, contra)
    .then(() => {});    
    return from(promise);
  }

  logout(): Observable<void>{
    const promise = signOut(this.firebaseAuth);
    return from(promise);
  }

  getUsers(): Observable<UserInterface[]> {
    const usersCollection = collection(this.firestore, 'users');
    return collectionData(usersCollection, { idField: 'id' }) as Observable<UserInterface[]>;
  }

  //iniciar sesion con telefono
  sendSMS(phone:string,buttonCaptcha:HTMLButtonElement,callback:(result:boolean)=>void){

    //verificacion del captcha
    this.recaptchaVerifier = new RecaptchaVerifier(this.firebaseAuth, buttonCaptcha, {'size': 'invisible'});
    this.recaptchaVerifier.verify().then((widgetId)=>{
      if (widgetId!=null){

        //enviar código y guardarlo en sessionstorage
        signInWithPhoneNumber(this.firebaseAuth,phone,this.recaptchaVerifier!).then((result)=>{
          sessionStorage.setItem('verificationId',JSON.stringify(result.verificationId));
          alert("Código enviado")
          callback(true);
        }).catch((error)=>{
          alert("Error al mandar el código: "+error.message);
          callback(false);
        });
      }else{
        alert("Error al verificar el captcha")
        callback(false);
      }
    });

    //si pasan 4 minutos el código expira
    setTimeout(()=>{
      sessionStorage.removeItem('verificationId');
      // alert("Tiempo excedido!")
      callback(false);
    },240000)
  }

  //confirmacion del código
  phoneConfirmationCode(code:string,callback:(result:boolean)=>void){
    //declaracion y comprobacion de credenciales
    let credentials=JSON.parse(sessionStorage.getItem('verificationId')||'{}');
    if(credentials=='{}'){
      alert("Error al verificar el codigo!");
      callback(false);
      return;
    }

    //si las credenciales son correctas, iniciar sesión
    let phoneCrenedtial=PhoneAuthProvider.credential(credentials,code);
    console.log("Codigo: "+code+" credentials: "+credentials)
    signInWithCredential(this.firebaseAuth,phoneCrenedtial).then((userCredential)=>{
    this.userCrenedtial=userCredential;
      alert("Bienvenido");
      callback(true);
      return;
    }).catch((error)=>{
      alert("Error al verificar el codigo: "+error.message);
      callback(false);
      return;
    });
  }

  constructor() { }
}