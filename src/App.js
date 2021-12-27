import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import React, { useState, useEffect } from 'react';
import {ethers} from 'ethers';

const App = () => {
  const [Clock, setClock] = useState(Date.now());
  /// contracts
  const [Simp, setSimp] = useState();
  const [Beneficiary, setBeneficiary] = useState('');
  const [Subscriber, setSubscriber] = useState();
  /// provider and signer
  const [Provider, setProvider] = useState();
  const [Signer, setSigner] = useState();
  /// strings and such for rendering
  const [EthBalance, setEthBalance] = useState();
  const [SimpBalance, setSimpBalance] = useState();
  const [CreditBalance, setCreditBalance] = useState();

  useEffect(() => {
    const loadSimp = async (data) => {
      let address = data.address;
      let abi = data.abi;
      let contract = new ethers.Contract(address, abi);
      setSimp(contract);
    }

    const loadBeneficiary = async(data) => {
      let address = data.address;
      let abi = data.abi;
      let contract = new ethers.Contract(address, abi);
      setBeneficiary(contract);
    }

    fetch('http://localhost:5000/simp', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json())
      .then(data=>{
        console.log(data.address);
        loadSimp(data);
      });
  
    fetch('http://localhost:5000/beneficiary', {
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    }).then(response => response.json())
      .then(data => {
        console.log(data.address);
        loadBeneficiary(data);
      })
  },[])

  useEffect(() => {
    const interval = setInterval(async ()=>{
      setClock(Date.now());
      /// check balance
      if(Provider && Subscriber && Simp) { 
        console.log('hello');
        setEthBalance((await Provider.getBalance(Subscriber.address)).toString());
        setSimpBalance((await Simp.connect(Signer).balanceOf(Subscriber.address)).toString());
        setCreditBalance((await Beneficiary.connect(Signer).credit(Subscriber.address)).toString());
      }
      //setSimpBalance();
    }, 500)

    return () => clearInterval(interval);
  },[Signer, Provider, Subscriber, Simp])

  const deploy = (e) => {
    /// deploy subscriber contract
    fetch('http://localhost:5000/subscriber', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json())
      .then(async data => {
        /// create contract factory instance
        /// then deploy contract
        let Factory = new ethers.ContractFactory(data.abi, data.bytecode, Signer);
        let SubscriberContract = await Factory.deploy();
        await SubscriberContract.deployed();
        setSubscriber(SubscriberContract);
      })
  }

  const fundEthSubscriber = async (e) => {
    /// ask backend to send test ether
    fetch('http://localhost:5000/faucet/eth', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ account: Subscriber.address })
    }).then(response => response.json())
      .then(data => {
        console.log(data);
        window.alert('succesful transfer');
      });
  }

  const fundEthWallet = async (e) => {
    /// ask backend to send test ether
    fetch('http://localhost:5000/faucet/eth', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ account: await Signer.getAddress() })
    }).then(response => response.json())
      .then(data => {
        console.log(data);
        window.alert('succesful transfer');
      });
  }

  const fundSimp = async(e) => {
    try {
      const tx = await Simp.connect(Signer).mint(Subscriber.address, ethers.constants.WeiPerEther.mul(100));
      console.log(await tx.wait());
      window.alert('successful transfer');
    } catch (err) {
      window.alert(err.message);
    }
  }

  /// Subscription in Ether
  const subscribe = async (e)=>{
    /// send address to backend
    await Subscriber.subscribe(
      Beneficiary.address,
      ethers.constants.WeiPerEther.div(10),
      30,
      0,
      ethers.constants.AddressZero,
      []
    )
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        account: Subscriber.address,
        amount: 0.1,
        period: 30,
        next_payment: 0,
        token: ethers.constants.AddressZero
      })
    };
    fetch('http://localhost:5000/subscribe', requestOptions)
      .then(response => response.json())
      .then(data => window.alert(data));
  }

  const connect = async (e) => {
    try{
      /// connect to wallet
      if(window.ethereum) { await window.ethereum.enable(); }
      const web3provider = new ethers.providers.Web3Provider(window.ethereum);
      const chainId = (await web3provider.getNetwork()).chainId;
      if(chainId===31337){
        setSigner(await web3provider.getSigner());
        setProvider(web3provider);
        console.log(await web3provider.getSigner(0).getAddress());
      } else {
        window.alert('Not Connected to Hardhat Network. Please reconnect using a wallet connected to the Rinkeby network');
      }
      /// add simp token
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: Simp.address,
            symbol: 'SIMP',
            decimals: 18,
          },
        },
      });
    } catch(err){
      window.alert(err.message);
    }
  }

  return (<>
    <p>
      {Date(Clock)}
    </p>{
      Signer?<>
      <Col>
        <p><u>Wallet Options</u></p>
        <Button onClick={fundEthWallet}>Fund Eth</Button>
      </Col>
      {Subscriber?<>
        <p><u>Subscribtion Wallet Options</u></p>
        <p>Subscriber Address: <span style={{color:"red"}}>{Subscriber.address}</span></p>
        <p>Eth Balance: <span style={{color: "blue"}}>{EthBalance} WEI</span></p>
        <p>Simp Balance: <span style={{color: "green"}}>{SimpBalance} SIMP</span></p>
        <Button onClick={fundEthSubscriber}>Fund Eth</Button>
        <Button onClick={fundSimp}>Fund Simp</Button>
        <Button onClick={subscribe}>Subscribe</Button>
        <p>
          Subscribing to <span style={{color: "orange"}}>{Beneficiary.address}</span>
        </p><p>
          Schedule 0.1 ETH payments every 10 seconds
        </p>
        <p>Credit Balance of <span style={{color: "purple"}}>{CreditBalance}</span></p>
      </>:<Col>
        <Button onClick={deploy}>Deploy Subscriber</Button>
      </Col>
    }</>:<>
      <Button onClick={connect}>Connect Wallet</Button>
    </>}
  </>);
}

export default App;
