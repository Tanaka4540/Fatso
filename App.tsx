import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';

type Profile = {
  id: string; name: string; age: number; bio: string | null; city: string | null;
  photo_url: string | null; interests: string[] | null; gender: string | null;
};

const colors = { bg:'#fbf7f9', card:'#fff', primary:'#9b3159', soft:'#f6e8ee', text:'#241f23', muted:'#766e72' };

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [tab, setTab] = useState<'discover'|'matches'|'messages'|'profile'>('discover');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) loadAll(); }, [session]);

  async function loadAll() {
    const {data: mine} = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    setMe(mine);
    const {data} = await supabase.from('profiles').select('*').neq('id', session.user.id).limit(30);
    setProfiles(data || []);
    const {data: myLikes} = await supabase.from('likes').select('to_user').eq('from_user', session.user.id);
    const ids = (myLikes || []).map((x:any)=>x.to_user);
    if (ids.length) {
      const {data: ms} = await supabase.from('matches').select('user_a,user_b').or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`);
      const otherIds = (ms || []).map((m:any)=>m.user_a === session.user.id ? m.user_b : m.user_a);
      if (otherIds.length) {
        const {data: mp} = await supabase.from('profiles').select('*').in('id', otherIds);
        setMatches(mp || []);
      }
    } else setMatches([]);
  }

  async function auth(signup:boolean) {
    if (!email || !password) return Alert.alert('Enter your email and password');
    const result = signup
      ? await supabase.auth.signUp({email, password})
      : await supabase.auth.signInWithPassword({email, password});
    if (result.error) Alert.alert('Soulmates', result.error.message);
    else if (signup) Alert.alert('Check your email', 'Confirm your email, then return to Soulmates.');
  }

  async function saveProfile() {
    if (!name || !age) return Alert.alert('Complete your profile', 'Name and age are required.');
    const {error} = await supabase.from('profiles').upsert({
      id: session.user.id, name, age:Number(age), bio, city, photo_url:photo
    });
    if (error) Alert.alert('Profile', error.message); else { Alert.alert('Saved'); loadAll(); }
  }

  async function choosePhoto() {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) return Alert.alert('Permission needed', 'Allow photo access to add a profile photo.');
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'], quality:.8});
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function useLocation() {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') return Alert.alert('Location', 'Location permission was not granted.');
    const loc = await Location.getCurrentPositionAsync({});
    await supabase.from('profiles').update({latitude:loc.coords.latitude, longitude:loc.coords.longitude}).eq('id', session.user.id);
    Alert.alert('Location saved', 'Your approximate location can now be used for nearby discovery.');
  }

  async function like(p:Profile) {
    const {error} = await supabase.from('likes').insert({from_user:session.user.id,to_user:p.id});
    if (error && !error.message.toLowerCase().includes('duplicate')) return Alert.alert('Like', error.message);
    const {data:back} = await supabase.from('likes').select('id').eq('from_user',p.id).eq('to_user',session.user.id).maybeSingle();
    if (back) Alert.alert("It's a match! 💕", `You and ${p.name} liked each other.`);
    setProfiles(x => x.filter(y=>y.id!==p.id)); loadAll();
  }

  async function pass(p:Profile) { setProfiles(x => x.filter(y=>y.id!==p.id)); }

  if (!session) return <AuthScreen email={email} password={password} setEmail={setEmail} setPassword={setPassword} auth={auth}/>;

  if (!me) return <ProfileSetup name={name} age={age} bio={bio} city={city} setName={setName} setAge={setAge} setBio={setBio} setCity={setCity} photo={photo} choosePhoto={choosePhoto} save={saveProfile} location={useLocation}/>;

  return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.header}><Text style={s.logo}>Soul<Text style={{color:colors.primary}}>mates</Text> ♥</Text></View>
    <View style={{flex:1}}>
      {tab==='discover' && <Discover profiles={profiles} like={like} pass={pass}/>}
      {tab==='matches' && <Matches matches={matches}/>}
      {tab==='messages' && <Messages matches={matches}/>}
      {tab==='profile' && <MyProfile me={me} signout={()=>supabase.auth.signOut()} location={useLocation}/>}
    </View>
    <View style={s.nav}>{[['discover','♥'],['matches','💞'],['messages','💬'],['profile','👤']].map(([id,icon])=><Pressable key={id} onPress={()=>setTab(id as any)} style={s.navItem}><Text style={[s.navIcon,tab===id&&{color:colors.primary}]}>{icon}</Text><Text style={[s.navLabel,tab===id&&{color:colors.primary}]}>{id}</Text></Pressable>)}</View>
  </SafeAreaView>;
}

function AuthScreen({email,password,setEmail,setPassword,auth}:{email:string;password:string;setEmail:(x:string)=>void;setPassword:(x:string)=>void;auth:(x:boolean)=>void}) {
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.auth}><Text style={s.bigLogo}>Soulmates ♥</Text><Text style={s.tagline}>Find someone worth choosing.</Text>
    <TextInput style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
    <TextInput style={s.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword}/>
    <Pressable style={s.primaryBtn} onPress={()=>auth(false)}><Text style={s.btnText}>Log in</Text></Pressable>
    <Pressable style={s.secondaryBtn} onPress={()=>auth(true)}><Text style={s.secondaryText}>Create account</Text></Pressable>
    <Text style={s.note}>18+ only. Be kind, be honest, stay safe.</Text>
  </ScrollView></SafeAreaView>
}

function ProfileSetup(p:any) { return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.auth}><Text style={s.title}>Create your Soulmates profile</Text>
  <Pressable style={s.photoPicker} onPress={p.choosePhoto}>{p.photo?<Image source={{uri:p.photo}} style={s.photoLarge}/>:<Text style={s.photoText}>+ Add a photo</Text>}</Pressable>
  <TextInput style={s.input} placeholder="First name" value={p.name} onChangeText={p.setName}/><TextInput style={s.input} placeholder="Age" keyboardType="number-pad" value={p.age} onChangeText={p.setAge}/>
  <TextInput style={[s.input,{height:100}]} placeholder="Tell people about yourself" multiline value={p.bio} onChangeText={p.setBio}/><TextInput style={s.input} placeholder="City" value={p.city} onChangeText={p.setCity}/>
  <Pressable style={s.secondaryBtn} onPress={p.location}><Text style={s.secondaryText}>📍 Use my location</Text></Pressable>
  <Pressable style={s.primaryBtn} onPress={p.save}><Text style={s.btnText}>Enter Soulmates</Text></Pressable>
</ScrollView></SafeAreaView> }

function Discover({profiles,like,pass}:any) { const p=profiles[0]; return <ScrollView contentContainerStyle={s.content}>{!p?<Text style={s.empty}>No more profiles right now. Check back soon. 💕</Text>:<><Text style={s.title}>People you may love</Text><View style={s.card}>{p.photo_url?<Image source={{uri:p.photo_url}} style={s.cardImg}/>:<View style={s.placeholder}><Text style={{fontSize:70}}>♥</Text></View>}<View style={s.cardInfo}><Text style={s.name}>{p.name}, {p.age}</Text><Text style={s.meta}>📍 {p.city || 'Nearby'}</Text><Text style={s.bio}>{p.bio || 'Looking for a meaningful connection.'}</Text></View></View><View style={s.actions}><Pressable style={s.action} onPress={()=>pass(p)}><Text>✕</Text></Pressable><Pressable style={s.action} onPress={()=>like(p)}><Text>♥</Text></Pressable></View></>}</ScrollView> }

function Matches({matches}:any){return <ScrollView contentContainerStyle={s.content}><Text style={s.title}>Your Matches 💕</Text>{matches.length?matches.map((m:Profile)=><View style={s.row} key={m.id}>{m.photo_url?<Image source={{uri:m.photo_url}} style={s.avatar}/>:<View style={s.avatar}/>}<View style={{flex:1}}><Text style={s.bold}>{m.name}</Text><Text style={s.muted}>You both liked each other</Text></View><Text style={{fontSize:22}}>💬</Text></View>):<Text style={s.empty}>Your matches will appear here.</Text>}</ScrollView>}
function Messages({matches}:any){return <ScrollView contentContainerStyle={s.content}><Text style={s.title}>Messages 💬</Text>{matches.map((m:Profile)=><View style={s.row} key={m.id}><View style={s.avatar}/><View><Text style={s.bold}>{m.name}</Text><Text style={s.muted}>Start a conversation ✨</Text></View></View>)}{!matches.length&&<Text style={s.empty}>Match with someone to start chatting.</Text>}</ScrollView>}
function MyProfile({me,signout,location}:any){return <ScrollView contentContainerStyle={s.content}><Text style={s.title}>My Profile</Text>{me.photo_url?<Image source={{uri:me.photo_url}} style={s.profilePhoto}/>:<View style={s.profilePhoto}/>}<Text style={s.name}>{me.name}, {me.age}</Text><Text style={s.bio}>{me.bio}</Text><Text style={s.meta}>📍 {me.city||'Location not set'}</Text><Pressable style={s.secondaryBtn} onPress={location}><Text style={s.secondaryText}>Update location</Text></Pressable><Pressable style={s.primaryBtn} onPress={signout}><Text style={s.btnText}>Log out</Text></Pressable></ScrollView>}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.bg}, header:{paddingHorizontal:20,paddingTop:12,paddingBottom:8},logo:{fontSize:28,fontWeight:'800',color:colors.text},bigLogo:{fontSize:42,fontWeight:'900',color:colors.primary,textAlign:'center'},tagline:{textAlign:'center',color:colors.muted,marginBottom:30},auth:{padding:24,justifyContent:'center',flexGrow:1},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#eadfe4',borderRadius:14,padding:15,marginBottom:12,fontSize:16},primaryBtn:{backgroundColor:colors.primary,borderRadius:15,padding:16,alignItems:'center',marginTop:10},secondaryBtn:{backgroundColor:colors.soft,borderRadius:15,padding:15,alignItems:'center',marginTop:10},btnText:{color:'#fff',fontWeight:'800'},secondaryText:{color:colors.primary,fontWeight:'800'},note:{textAlign:'center',color:colors.muted,fontSize:12,marginTop:20},content:{padding:18,paddingBottom:100},title:{fontSize:25,fontWeight:'900',color:colors.text,marginBottom:16},card:{backgroundColor:'#fff',borderRadius:25,overflow:'hidden',elevation:4},cardImg:{width:'100%',height:470},placeholder:{height:470,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft},cardInfo:{padding:18},name:{fontSize:28,fontWeight:'900',color:colors.text},meta:{color:colors.muted,marginTop:5},bio:{color:colors.text,lineHeight:21,marginTop:12},actions:{flexDirection:'row',justifyContent:'center',gap:25,marginTop:20},action:{width:64,height:64,borderRadius:32,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',elevation:3},nav:{position:'absolute',bottom:0,left:0,right:0,height:74,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#eee',flexDirection:'row',justifyContent:'space-around'},navItem:{alignItems:'center',justifyContent:'center',flex:1},navIcon:{fontSize:22},navLabel:{fontSize:10,color:colors.muted,marginTop:2},empty:{textAlign:'center',color:colors.muted,marginTop:80},row:{backgroundColor:'#fff',padding:14,borderRadius:15,marginBottom:10,flexDirection:'row',alignItems:'center',gap:12},avatar:{width:52,height:52,borderRadius:26,backgroundColor:'#e6b7c7'},bold:{fontWeight:'800',fontSize:16},muted:{color:colors.muted,fontSize:13,marginTop:3},photoPicker:{width:150,height:150,borderRadius:75,backgroundColor:colors.soft,alignSelf:'center',alignItems:'center',justifyContent:'center',marginBottom:20,overflow:'hidden'},photoLarge:{width:'100%',height:'100%'},photoText:{color:colors.primary,fontWeight:'800'},profilePhoto:{width:180,height:180,borderRadius:90,backgroundColor:colors.soft,alignSelf:'center',marginBottom:18}
});
